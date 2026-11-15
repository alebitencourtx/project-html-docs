import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from '../scripts/build.mjs';
import { analyzeImpact, renderUpdatePlan } from '../scripts/verify.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dossier-test-'));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('inspect_repo.py extracts Databricks notebooks, PySpark/Event Hubs/Blob/Cosmos I/O, SQL lineage, API routes, IaC, secret redaction and reading-plan.md', () =>
  withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, 'src/lakehouse'), { recursive: true });
    await fs.mkdir(path.join(dir, 'notebooks'), { recursive: true });
    await fs.mkdir(path.join(dir, 'sql'), { recursive: true });
    await fs.mkdir(path.join(dir, 'infra'), { recursive: true });
    await fs.mkdir(path.join(dir, 'tests'), { recursive: true });

    await fs.writeFile(
      path.join(dir, 'databricks.yml'),
      [
        'bundle:',
        '  name: telemetry-lakehouse',
        'resources:',
        '  jobs:',
        '    stream_ingest:',
        '      schedule:',
        '        quartz_cron_expression: "0 */15 * * * ?"',
        '      tasks:',
        '        - task_key: bronze_stream',
        '          notebook_task:',
        '            notebook_path: ../notebooks/bronze_eventhub.py',
      ].join('\n'),
    );

    await fs.writeFile(
      path.join(dir, 'src/lakehouse/schemas.py'),
      [
        'from pydantic import BaseModel',
        'API_KEY = "super-secret-value-never-leak"',
        'RETENTION_DAYS = 90',
        '',
        'class TelemetryEvent(BaseModel):',
        '    event_id: str',
        '    tenant_id: str',
        '    amount: float',
      ].join('\n'),
    );

    await fs.writeFile(
      path.join(dir, 'notebooks/bronze_eventhub.py'),
      [
        '# Databricks notebook source',
        'from pyspark.sql.types import StructType, StructField, StringType',
        'from src.lakehouse.schemas import TelemetryEvent',
        '',
        'env = dbutils.widgets.get("env")',
        'eh_conn = dbutils.secrets.get("kv-prod", "eventhub-listen-sas")',
        'schema = StructType([StructField("event_id", StringType()), StructField("payload", StringType())])',
        'df = (spark.readStream.format("eventhubs")',
        '    .option("eventhubs.name", "events-in")',
        '    .load("abfss://bronze@datalake.dfs.core.windows.net/events"))',
        '(df.writeStream.format("delta")',
        '    .option("checkpointLocation", "abfss://checkpoints@datalake.dfs.core.windows.net/bronze")',
        '    .table("prod.bronze.events_raw"))',
        '',
        '# COMMAND ----------',
        '# MAGIC %sql',
        '# MAGIC CREATE OR REPLACE TABLE prod.silver.events_clean USING DELTA AS',
        '# MAGIC SELECT event_id, payload FROM prod.bronze.events_raw;',
      ].join('\n'),
    );

    await fs.writeFile(
      path.join(dir, 'src/lakehouse/serving.py'),
      [
        'from fastapi import APIRouter',
        'from azure.cosmos import CosmosClient',
        'from azure.storage.blob import BlobServiceClient',
        'from src.lakehouse.schemas import TelemetryEvent',
        '',
        'router = APIRouter(prefix="/v1")',
        '',
        'def write_serving_doc(client: CosmosClient, item: dict) -> None:',
        '    container = client.get_container_client("telemetry")',
        '    container.upsert_item(item)',
        '',
        'def archive_blob(blob_client: BlobServiceClient) -> None:',
        '    c = blob_client.get_container_client("archive")',
        '    c.upload_blob("snap.json", "{}")',
        '',
        '@router.get("/telemetry/{tenant_id}")',
        'async def get_telemetry(tenant_id: str) -> TelemetryEvent:',
        '    """Fetch latest tenant telemetry."""',
        '    pass',
      ].join('\n'),
    );

    await fs.writeFile(
      path.join(dir, 'sql/gold_summary.sql'),
      [
        'MERGE INTO prod.gold.daily_telemetry AS tgt',
        'USING prod.silver.events_clean AS src',
        'ON tgt.event_id = src.event_id',
        'WHEN MATCHED THEN UPDATE SET tgt.payload = src.payload;',
      ].join('\n'),
    );

    await fs.writeFile(
      path.join(dir, 'infra/main.tf'),
      [
        'resource "azurerm_cosmosdb_account" "cosmos" {}',
        'resource "azurerm_eventhub_namespace" "eh" {}',
        'resource "azurerm_storage_account" "adls" {}',
      ].join('\n'),
    );

    await fs.writeFile(
      path.join(dir, 'tests/test_serving.py'),
      [
        'def test_cosmos_upsert():',
        '    assert True',
      ].join('\n'),
    );

    const outJson = path.join(dir, 'inventory.json');
    const outPlan = path.join(dir, 'reading-plan.md');
    execFileSync('python3', [path.join(root, 'scripts/inspect_repo.py'), dir, '--out', outJson, '--plan', outPlan]);

    const dossier = JSON.parse(await fs.readFile(outJson, 'utf8'));
    const planMd = await fs.readFile(outPlan, 'utf8');

    // Priority cloud/DE stack detection
    for (const sig of ['spark_pyspark', 'databricks', 'delta_lake', 'cosmos_db', 'event_hubs', 'azure_blob_adls', 'api_service', 'terraform_iac']) {
      assert.ok(dossier.stackSignals[sig] >= 1, `Expected stackSignal ${sig}`);
    }

    // Secret redaction check
    const schemaConsts = dossier.symbolIndex['src/lakehouse/schemas.py'].constants;
    const apiKeyConst = schemaConsts.find((c) => c.name === 'API_KEY');
    assert.equal(apiKeyConst.value, '<redacted>');
    assert.ok(!planMd.includes('super-secret-value-never-leak'));

    // Databricks notebook, API endpoint, IaC, dataContracts, SQL lineage, testsIndex
    assert.equal(dossier.notebooks.length, 1);
    assert.equal(dossier.notebooks[0].path, 'notebooks/bronze_eventhub.py');
    assert.ok(dossier.entrypoints.endpoints.some((e) => e.method === 'GET' && e.path === '/v1/telemetry/{tenant_id}'));
    assert.equal(dossier.iacResources[0].resources.length, 3);
    assert.ok(dossier.dataContracts.some((c) => c.name === 'TelemetryEvent' && c.fields.length === 3));
    assert.ok(dossier.sqlLineage.some((s) => s.targets.some((t) => t.target === 'prod.gold.daily_telemetry')));
    assert.deepEqual(dossier.testsIndex['tests/test_serving.py'].map((t) => t.name), ['test_cosmos_upsert']);

    // Dependency graph & reading waves
    assert.ok(dossier.dependencyGraph.edges.some((e) => e.from === 'src/lakehouse/serving.py' && e.to === 'src/lakehouse/schemas.py' && e.kind === 'import'));
    assert.ok(dossier.dependencyGraph.edges.some((e) => e.from === 'databricks.yml' && e.to === 'notebooks/bronze_eventhub.py' && e.kind === 'bundle_task'));
    assert.equal(dossier.scaleProfile.tier, 'small');
    assert.ok(planMd.includes('Onda 1') && planMd.includes('Onda 2'));
  }));

test('verify.mjs --impact propagates drift through dependency graph and marks only stale sections', () =>
  withTempDir(async (dir) => {
    const repo = path.join(dir, 'repo');
    const docs = path.join(dir, 'docs');
    await fs.mkdir(path.join(repo, 'src'), { recursive: true });
    await fs.mkdir(docs, { recursive: true });

    await fs.writeFile(path.join(repo, 'src/config.py'), 'THRESHOLD = 10\n');
    await fs.writeFile(path.join(repo, 'src/pipeline.py'), 'from src.config import THRESHOLD\nRUN = THRESHOLD\n');
    await fs.writeFile(path.join(repo, 'src/ui.py'), 'TITLE = "Dashboard"\n');

    const manifest = {
      title: 'Impact Test',
      subtitle: 'Incremental update verification',
      version: '1.0',
      updated: '2026-11-14',
      repoRoot: '../repo',
      content: 'content.md',
      sections: [
        { id: 'rules', title: 'Rules', audience: 'business', sources: ['cfg'] },
        { id: 'processing', title: 'Processing', audience: 'technical', sources: ['pipe'] },
        { id: 'ui', title: 'Dashboard UI', audience: 'business', sources: ['ui'] },
      ],
      sources: [
        { id: 'cfg', path: 'src/config.py', description: 'Thresholds' },
        { id: 'pipe', path: 'src/pipeline.py', description: 'Core pipeline' },
        { id: 'ui', path: 'src/ui.py', description: 'UI view' },
      ],
    };
    await fs.writeFile(path.join(docs, 'document.json'), JSON.stringify(manifest, null, 2));
    await fs.writeFile(path.join(docs, 'content.md'), '## Rules\n\nR\n\n## Processing\n\nP\n\n## Dashboard UI\n\nU\n');

    const outHtml = path.join(docs, 'doc.html');
    await build(path.join(docs, 'document.json'), outHtml);
    const receiptPath = path.join(docs, 'doc.validation.json');

    // Now modify ONLY src/config.py and add a new untracked core file src/new_job.py
    await fs.writeFile(path.join(repo, 'src/config.py'), 'THRESHOLD = 25\n');
    await fs.writeFile(path.join(repo, 'src/new_job.py'), 'def run():\n    pass\n');

    const dossierPath = path.join(docs, 'inventory.json');
    execFileSync('python3', [path.join(root, 'scripts/inspect_repo.py'), repo, '--out', dossierPath]);

    const impact = await analyzeImpact(path.join(docs, 'document.json'), receiptPath, { dossierFile: dossierPath });
    assert.equal(impact.ok, false);
    assert.deepEqual(impact.impactedPaths.direct, ['src/config.py']);
    assert.deepEqual(impact.impactedPaths.transitive, ['src/pipeline.py']);

    // Rules (direct) and Processing (transitive) are stale; UI stays fresh!
    const staleIds = impact.impactedSections.map((s) => s.id);
    const freshIds = impact.freshSections.map((s) => s.id);
    assert.deepEqual(staleIds, ['rules', 'processing']);
    assert.deepEqual(freshIds, ['ui']);
    assert.equal(impact.untrackedCoreFiles.some((f) => f.path === 'src/new_job.py'), true);

    const planText = renderUpdatePlan(impact);
    assert.match(planText, /Reabrir e revisar apenas estas seções/);
    assert.match(planText, /src\/new_job\.py/);
  }));

test('inspect_repo.py v1.5.0 extracts chained PySpark I/O, %run/notebook.run, env/CLI params, ADF pipelines, Scala, and respects .docignore', () =>
  withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, 'notebooks'), { recursive: true });
    await fs.mkdir(path.join(dir, 'adf'), { recursive: true });
    await fs.mkdir(path.join(dir, 'scala'), { recursive: true });
    await fs.mkdir(path.join(dir, 'ignored_dir'), { recursive: true });

    await fs.writeFile(path.join(dir, '.docignore'), 'ignored_dir\n*.tmp.py\n');
    await fs.writeFile(path.join(dir, 'ignored_dir/skip.py'), 'SECRET = "abc"\n');
    await fs.writeFile(path.join(dir, 'reading-plan.md'), '# stale plan\n');
    await fs.writeFile(path.join(dir, 'doc.validation.json'), '{"passed":true}\n');

    await fs.writeFile(
      path.join(dir, 'notebooks/child_lib.py'),
      '# Databricks notebook source\nprint("helper")\n',
    );
    await fs.writeFile(
      path.join(dir, 'notebooks/main_etl.py'),
      [
        '# Databricks notebook source',
        '# MAGIC %run ./child_lib',
        'import os, argparse',
        '',
        'CATALOG = os.getenv("UNITY_CATALOG", "prod_lake")',
        'TOKEN = os.environ["API_TOKEN"]',
        'COSMOS_CFG = {"spark.cosmos.accountEndpoint": "https://acct.documents.azure.com", "spark.cosmos.masterKey": "secret-123"}',
        '',
        'def parse_args():',
        '    p = argparse.ArgumentParser()',
        '    p.add_argument("--dt-ref", default="2026-11-14", help="Reference date")',
        '    return p.parse_args()',
        '',
        'def run():',
        '    dbutils.notebook.run("/notebooks/child_lib", 60)',
        '    df = spark.readStream.format("cloudFiles").option("checkpointLocation", "abfss://chk@acct.dfs.core.windows.net/c1").load("abfss://raw@acct.dfs.core.windows.net/in")',
        '    df.writeStream.format("delta").mode("append").partitionBy("dt_ref").trigger(availableNow=True).saveAsTable("prod.silver.events")',
      ].join('\n'),
    );
    await fs.writeFile(
      path.join(dir, 'adf/pl_daily.json'),
      JSON.stringify({
        name: 'pl_daily_ingest',
        properties: {
          activities: [
            {
              name: 'RunMainEtl',
              type: 'DatabricksNotebook',
              dependsOn: [],
              typeProperties: { notebookPath: '/notebooks/main_etl' },
            },
          ],
        },
      }),
    );
    await fs.writeFile(
      path.join(dir, 'scala/StreamJob.scala'),
      [
        'package com.lake.jobs',
        'import org.apache.spark.sql.SparkSession',
        'object StreamJob extends App {',
        '  val df = spark.read.format("delta").table("prod.bronze.events")',
        '}',
      ].join('\n'),
    );

    const outJson = path.join(dir, 'inventory.json');
    const outPlan = path.join(dir, 'reading-plan.md');
    execFileSync('python3', [path.join(root, 'scripts/inspect_repo.py'), dir, '--out', outJson, '--plan', outPlan]);
    const dossier = JSON.parse(await fs.readFile(outJson, 'utf8'));
    const planMd = await fs.readFile(outPlan, 'utf8');

    assert.equal(dossier.dossierVersion, '1.5.0');
    assert.ok(!dossier.files.some((f) => f.path.includes('ignored_dir') || f.path === 'reading-plan.md' || f.path === 'doc.validation.json'));
    assert.ok(dossier.stackSignals.scala >= 1);
    assert.ok(dossier.stackSignals.orchestration >= 1);
    assert.equal(dossier.entrypoints.adfPipelines.length, 1);

    // Chained PySpark metadata
    const mainIo = dossier.symbolIndex['notebooks/main_etl.py'].dataIO;
    const writeNode = mainIo.find((io) => io.op === 'spark_write_stream');
    assert.equal(writeNode.format, 'delta');
    assert.equal(writeNode.mode, 'append');
    assert.deepEqual(writeNode.partitionBy, ['dt_ref']);
    assert.deepEqual(writeNode.trigger, { availableNow: true });

    const cosmosDict = mainIo.find((io) => io.op === 'spark_config_dict');
    assert.equal(cosmosDict.options['spark.cosmos.masterKey'], '<redacted>');

    // Dependency graph edges: ADF -> main_etl & main_etl -> child_lib
    assert.ok(dossier.dependencyGraph.edges.some((e) => e.from === 'adf/pl_daily.json' && e.to === 'notebooks/main_etl.py' && e.kind === 'adf_activity'));
    assert.ok(dossier.dependencyGraph.edges.some((e) => e.from === 'notebooks/main_etl.py' && e.to === 'notebooks/child_lib.py' && e.kind === 'notebook_run'));

    // Env / CLI params
    assert.ok(dossier.envAndCliParams.some((p) => p.name === 'UNITY_CATALOG' && p.default === 'prod_lake'));
    assert.ok(dossier.envAndCliParams.some((p) => p.name === '--dt-ref' && p.default === '2026-11-14'));
    assert.ok(planMd.includes('Azure Data Factory / Synapse Pipelines'));
    assert.ok(planMd.includes('UNITY_CATALOG'));
  }));

test('verify.mjs detects skill renderer updates independently of source drift and recommends rebuild-only', () =>
  withTempDir(async (dir) => {
    const repo = path.join(dir, 'repo');
    const docs = path.join(dir, 'docs');
    await fs.mkdir(path.join(repo, 'src'), { recursive: true });
    await fs.mkdir(docs, { recursive: true });

    await fs.writeFile(path.join(repo, 'src/app.py'), 'print("ok")\n');
    const manifest = {
      title: 'Renderer Drift Test',
      subtitle: 'Skill update detection',
      version: '1.0',
      updated: '2026-11-15',
      repoRoot: '../repo',
      content: 'content.md',
      sections: [{ id: 'overview', title: 'Overview', audience: 'all', sources: ['app'] }],
      sources: [{ id: 'app', path: 'src/app.py', description: 'App' }],
    };
    await fs.writeFile(path.join(docs, 'document.json'), JSON.stringify(manifest, null, 2));
    await fs.writeFile(path.join(docs, 'content.md'), '## Overview\n\nUp to date prose.\n');

    const outHtml = path.join(docs, 'doc.html');
    const receipt = await build(path.join(docs, 'document.json'), outHtml);
    assert.match(receipt.rendererSha256, /^[a-f0-9]{64}$/);

    const receiptPath = path.join(docs, 'doc.validation.json');
    const dossierPath = path.join(docs, 'inventory.json');
    execFileSync('python3', [path.join(root, 'scripts/inspect_repo.py'), repo, '--out', dossierPath]);

    // 1. Freshly built HTML matches current skill renderer
    const freshImpact = await analyzeImpact(path.join(docs, 'document.json'), receiptPath, { dossierFile: dossierPath });
    assert.equal(freshImpact.ok, true);
    assert.equal(freshImpact.renderer.matches, true);
    assert.equal(freshImpact.renderer.needsRebuild, false);
    assert.match(renderUpdatePlan(freshImpact), /Sincronizado \(nenhuma atualização necessária\)/);

    // 2. Simulate an older skill renderer hash while source files remain unchanged
    const olderReceipt = { ...receipt, skillVersion: '1.6.0', rendererSha256: '0'.repeat(64) };
    await fs.writeFile(receiptPath, JSON.stringify(olderReceipt, null, 2));

    const skillDriftImpact = await analyzeImpact(path.join(docs, 'document.json'), receiptPath, { dossierFile: dossierPath });
    assert.equal(skillDriftImpact.ok, true);
    assert.equal(skillDriftImpact.renderer.matches, false);
    assert.equal(skillDriftImpact.renderer.needsRebuild, true);
    assert.equal(skillDriftImpact.impactedSections.length, 0);
    const driftPlan = renderUpdatePlan(skillDriftImpact);
    assert.match(driftPlan, /Template da skill atualizado/);
    assert.match(driftPlan, /build\.mjs .*--force/);
    assert.match(driftPlan, /não é necessário reler o repositório/);

    // 3. Simulate a legacy receipt built before rendererSha256 existed
    const legacyReceipt = { ...receipt, skillVersion: '1.7.0' };
    delete legacyReceipt.rendererSha256;
    await fs.writeFile(receiptPath, JSON.stringify(legacyReceipt, null, 2));

    const legacyImpact = await analyzeImpact(path.join(docs, 'document.json'), receiptPath, { dossierFile: dossierPath });
    assert.equal(legacyImpact.ok, true);
    assert.equal(legacyImpact.renderer.matches, null);
    assert.equal(legacyImpact.renderer.needsRebuild, true);
    assert.match(renderUpdatePlan(legacyImpact), /recibo legado/);
  }));

test('inspect_repo.py v1.9.0 discovers src/data & src/env, parses JS/TS interfaces & arrow functions, redacts workflow tokens, and supports .docignore negations', () =>
  withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, 'src/data'), { recursive: true });
    await fs.mkdir(path.join(dir, 'src/env'), { recursive: true });
    await fs.mkdir(path.join(dir, '.github/workflows'), { recursive: true });
    await fs.mkdir(path.join(dir, 'gen'), { recursive: true });

    await fs.writeFile(path.join(dir, '.docignore'), 'gen/*\n!gen/keep.ts\n/root_only.tmp\n');
    await fs.writeFile(path.join(dir, 'gen/drop.ts'), 'export const drop = true;\n');
    await fs.writeFile(path.join(dir, 'gen/keep.ts'), 'export interface KeptContract { id: string; }\nexport const loadConfig = () => process.env.SERVICE_MODE || "prod";\n');
    await fs.writeFile(path.join(dir, 'root_only.tmp'), 'ignored');
    await fs.writeFile(path.join(dir, 'src/data/repo.ts'), 'export type RecordId = string;\nexport const fetchItem = async (id: string) => id;\n');
    await fs.writeFile(path.join(dir, 'src/env/config.mjs'), 'export const mode = import.meta.env?.VITE_MODE || "live";\n');
    await fs.writeFile(
      path.join(dir, '.github/workflows/deploy.yml'),
      'name: Deploy\non: [push]\njobs:\n  push:\n    runs-on: ubuntu-latest\n    steps:\n      - run: curl -H "Authorization: Bearer ghp_1234567890abcdefghijklmnop" https://api.github.com\n',
    );

    const outJson = path.join(dir, 'inv.json');
    execFileSync('python3', [path.join(root, 'scripts/inspect_repo.py'), dir, '--out', outJson]);
    const inv = JSON.parse(await fs.readFile(outJson, 'utf8'));
    const paths = inv.files.map((f) => f.path);

    assert.ok(paths.includes('src/data/repo.ts'));
    assert.ok(paths.includes('src/env/config.mjs'));
    assert.ok(paths.includes('gen/keep.ts'));
    assert.ok(!paths.includes('gen/drop.ts'));
    assert.ok(!paths.includes('root_only.tmp'));

    assert.ok(inv.dataContracts.some((c) => c.name === 'KeptContract'));
    assert.ok(inv.symbolIndex['src/data/repo.ts'].symbols.some((fn) => fn.name === 'fetchItem'));
    assert.ok(inv.envAndCliParams.some((p) => p.name === 'SERVICE_MODE'));
    assert.ok(inv.envAndCliParams.some((p) => p.name === 'VITE_MODE'));

    const invText = await fs.readFile(outJson, 'utf8');
    assert.ok(!invText.includes('ghp_1234567890abcdefghijklmnop'), 'Token literal must never survive redaction');
  }));

test('verify.mjs v1.9.0 detects artifact drift, accepts doc-only git advances, truncates >25 untracked files, and supports --mark-reviewed', () =>
  withTempDir(async (dir) => {
    const repo = path.join(dir, 'repo');
    const docs = path.join(dir, 'docs');
    await fs.mkdir(path.join(repo, 'src'), { recursive: true });
    await fs.mkdir(docs, { recursive: true });

    execFileSync('git', ['-C', repo, 'init']);
    execFileSync('git', ['-C', repo, 'config', 'user.email', 'test@example.com']);
    execFileSync('git', ['-C', repo, 'config', 'user.name', 'Test User']);
    await fs.writeFile(path.join(repo, 'src/app.py'), 'print("v1")\n');
    execFileSync('git', ['-C', repo, 'add', '.']);
    execFileSync('git', ['-C', repo, 'commit', '-m', 'init code']);
    const codeRev = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

    await fs.writeFile(path.join(docs, 'document.json'), JSON.stringify({
      title: 'Doc Only Test', subtitle: 'Verify v1.9.0', version: '1.0.0', updated: '2026-11-15',
      repoRoot: '../repo', revision: codeRev, content: 'content.md',
      sections: [{ id: 'overview', title: 'Overview', audience: 'all', sources: ['app'] }],
      sources: [{ id: 'app', path: 'src/app.py', description: 'App' }],
    }, null, 2));
    await fs.writeFile(path.join(docs, 'content.md'), '## Overview\n\nImplemented behavior.\n');

    const htmlOut = path.join(docs, 'manual.html');
    await build(path.join(docs, 'document.json'), htmlOut);
    const receiptPath = path.join(docs, 'manual.validation.json');

    // Add a non-source README commit so git HEAD advances without changing src/app.py
    await fs.writeFile(path.join(repo, 'README.md'), '# Docs commit\n');
    execFileSync('git', ['-C', repo, 'add', 'README.md']);
    execFileSync('git', ['-C', repo, 'commit', '-m', 'docs only commit']);

    const docOnlyOut = execFileSync('node', [
      path.join(root, 'scripts/verify.mjs'),
      path.join(docs, 'document.json'),
      receiptPath,
      '--strict',
      '--mark-reviewed',
    ], { encoding: 'utf8' });
    const parsedDocOnly = JSON.parse(docOnlyOut);
    assert.equal(parsedDocOnly.ok, true);
    assert.equal(parsedDocOnly.revision.matches, false);
    assert.equal(parsedDocOnly.revision.sourceDrift, false);
    assert.equal(parsedDocOnly.browserReviewed, true);

    const updatedReceipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
    assert.equal(updatedReceipt.browserReviewed, true);
    assert.ok(updatedReceipt.browserReviewedAt);

    // Editing content.md without rebuilding must trigger artifact drift detection
    await fs.writeFile(path.join(docs, 'content.md'), '## Overview\n\nEdited without rebuild.\n');
    const impact = await analyzeImpact(path.join(docs, 'document.json'), receiptPath);
    assert.equal(impact.ok, false);
    assert.equal(impact.artifacts.contentMatches, false);
    assert.match(renderUpdatePlan(impact), /Artefatos de Autoria Divergentes do Recibo/);

    // >25 untracked files summary truncation check
    const fakeImpact = {
      ...impact,
      ok: true,
      artifacts: { manifestMatches: true, contentMatches: true, htmlMatches: true },
      untrackedCoreFiles: Array.from({ length: 30 }, (_, i) => ({ path: `src/f${i}.py`, wave: 2, kind: 'python', centrality: 0 })),
    };
    assert.match(renderUpdatePlan(fakeImpact), /\.\.\. e mais 5 arquivo\(s\) não listado\(s\)\./);
  }));

test('F02, F04, F07, F08, F09 & M04: redaction before truncation, lambda/subscript isolation, reexports/.ipynb/.mts edges, balanced DDL types, Blob vs Cosmos disambiguation, and streaming toTable', () =>
  withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, 'src'), { recursive: true });
    await fs.mkdir(path.join(dir, 'notebooks'), { recursive: true });
    await fs.mkdir(path.join(dir, 'sql'), { recursive: true });
    await fs.mkdir(path.join(dir, '.github/workflows'), { recursive: true });

    // F02: CLI passwords in workflows & package.json scripts + long command truncation
    await fs.writeFile(
      path.join(dir, '.github/workflows/deploy.yml'),
      'name: Deploy\non: [push]\njobs:\n  deploy:\n    steps:\n      - run: ' + 'echo step && '.repeat(12) + 'tool --password AUDIT_FAKE_PASSWORD_123 -p=SHORT_PASS_999\n',
    );
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        version: '1.0.0',
        scripts: { deploy: 'tool --password PKG_SECRET_PASSWORD_123 --api-key=PKG_API_KEY_999' },
      }),
    );

    // F04: valid lambda & subscript calls + broken syntax file isolated with parseWarnings
    await fs.writeFile(
      path.join(dir, 'src/lambdas.py'),
      '(lambda: 1)()\nhandlers = {"run": lambda: 2}\nhandlers["run"]()\n',
    );
    await fs.writeFile(path.join(dir, 'src/broken.py'), 'def oops(:\n  pass\n');

    // F07: JS/TS reexports, side-effect imports, dynamic imports, .mts + .ipynb Python imports
    await fs.writeFile(path.join(dir, 'src/lib.mts'), 'export const VAL = 42;\n');
    await fs.writeFile(path.join(dir, 'src/reexport.mts'), 'export { VAL } from "./lib";\n');
    await fs.writeFile(path.join(dir, 'src/side.ts'), 'import "./lib";\nconst m = import("./reexport");\n');
    await fs.writeFile(path.join(dir, 'src/nb_config.py'), 'BATCH_SIZE = 100\n');
    await fs.writeFile(
      path.join(dir, 'notebooks/analysis.ipynb'),
      JSON.stringify({
        cells: [{ cell_type: 'code', source: ['from src.nb_config import BATCH_SIZE\n', 'print(BATCH_SIZE)\n'] }],
        metadata: {},
        nbformat: 4,
        nbformat_minor: 5,
      }),
    );

    // F08: DDL with parenthesized types + comma inside DECIMAL(10, 2) + STRUCT<...>
    await fs.writeFile(
      path.join(dir, 'sql/tables.sql'),
      'CREATE TABLE payment (\n  id INT,\n  amount DECIMAL(10, 2),\n  status VARCHAR(30),\n  meta STRUCT<kind STRING, ver INT>\n);\n',
    );

    // F09: Blob vs Cosmos disambiguation + Spark streaming outputMode + toTable
    await fs.writeFile(
      path.join(dir, 'src/storage_and_stream.py'),
      [
        'from azure.storage.blob import BlobServiceClient',
        'from azure.cosmos import CosmosClient',
        '',
        'def copy_blob(blob_client: BlobServiceClient):',
        '    container = blob_client.get_container_client("archive")',
        '    container.upload_blob("snap.json", "{}")',
        '',
        'def write_cosmos(cosmos_client: CosmosClient):',
        '    container = cosmos_client.get_container_client("telemetry")',
        '    container.upsert_item({"id": "1"})',
        '',
        'def stream_events(df):',
        '    df.writeStream.format("delta").outputMode("append").toTable("db.events")',
      ].join('\n'),
    );

    // M04: Oversized file tracking in omittedCounts/omittedFiles
    await fs.writeFile(path.join(dir, 'src/huge.py'), 'x = "' + 'A'.repeat(2 * 1024 * 1024 + 32) + '"\n');

    const outJson = path.join(dir, 'inv.json');
    const outPlan = path.join(dir, 'reading-plan.md');
    execFileSync('python3', [path.join(root, 'scripts/inspect_repo.py'), dir, '--out', outJson, '--plan', outPlan]);
    const invText = await fs.readFile(outJson, 'utf8');
    const planText = await fs.readFile(outPlan, 'utf8');
    const inv = JSON.parse(invText);

    // F02 checks
    for (const secret of ['AUDIT_FAKE_PASSWORD_123', 'SHORT_PASS_999', 'PKG_SECRET_PASSWORD_123', 'PKG_API_KEY_999']) {
      assert.ok(!invText.includes(secret), `Secret ${secret} must not appear anywhere in inventory.json`);
      assert.ok(!planText.includes(secret), `Secret ${secret} must not appear anywhere in reading-plan.md`);
    }

    // F04 & M04 checks
    assert.ok(inv.files.some((f) => f.path === 'src/lambdas.py'));
    assert.ok(inv.parseWarnings.some((w) => w.file === 'src/broken.py'));
    assert.ok(inv.omittedCounts.max_size_exceeded >= 1);
    assert.ok(inv.omittedFiles.some((o) => o.path === 'src/huge.py' && o.reason === 'max_size_exceeded'));
    assert.match(planText, /src\/broken\.py/);
    assert.match(planText, /max_size_exceeded/);

    // F07 checks
    assert.ok(inv.files.some((f) => f.path === 'src/lib.mts'));
    assert.ok(inv.dependencyGraph.edges.some((e) => e.from === 'src/reexport.mts' && e.to === 'src/lib.mts'));
    assert.ok(inv.dependencyGraph.edges.some((e) => e.from === 'src/side.ts' && e.to === 'src/lib.mts'));
    assert.ok(inv.dependencyGraph.edges.some((e) => e.from === 'src/side.ts' && e.to === 'src/reexport.mts'));
    assert.ok(inv.dependencyGraph.edges.some((e) => e.from === 'notebooks/analysis.ipynb' && e.to === 'src/nb_config.py'));

    // F08 checks
    const paymentContract = inv.dataContracts.find((c) => c.name === 'payment' && c.kind === 'sql_ddl');
    assert.ok(paymentContract, 'Expected payment table dataContract');
    assert.deepEqual(
      paymentContract.fields.map((f) => f.name),
      ['id', 'amount', 'status', 'meta'],
    );
    assert.match(paymentContract.fields.find((f) => f.name === 'amount').type, /DECIMAL\(10,\s*2\)/i);
    assert.match(paymentContract.fields.find((f) => f.name === 'status').type, /VARCHAR\(30\)/i);

    // F09 checks
    const io = inv.symbolIndex['src/storage_and_stream.py'].dataIO;
    assert.ok(io.some((entry) => entry.op === 'azure_blob_adls' && entry.method === 'get_container_client' && entry.target === 'archive'), 'blob_client.get_container_client must map to azure_blob_adls');
    assert.ok(!io.some((entry) => entry.op === 'cosmos_db' && entry.target === 'archive'), 'archive blob container must NOT be misclassified as cosmos_db');
    assert.ok(io.some((entry) => entry.op === 'cosmos_db' && entry.method === 'get_container_client' && entry.target === 'telemetry'), 'cosmos_client.get_container_client must map to cosmos_db');
    const streamWrite = io.find((entry) => entry.op === 'spark_write_stream');
    assert.ok(streamWrite, 'Expected spark_write_stream from .toTable("db.events")');
    assert.equal(streamWrite.target, 'db.events');
    assert.equal(streamWrite.outputMode, 'append');

    // F07 end-to-end transitive --impact check when dependency src/lib.mts or src/nb_config.py changes
    const docs = path.join(dir, '_docs');
    await fs.mkdir(docs, { recursive: true });
    await fs.writeFile(
      path.join(docs, 'document.json'),
      JSON.stringify({
        title: 'Impact Graph F07',
        subtitle: 'Transitive reexport and ipynb propagation',
        version: '1.0.0',
        updated: '2026-11-15',
        repoRoot: '..',
        content: 'content.md',
        sections: [
          { id: 'lib-sec', title: 'Base Lib', audience: 'technical', sources: ['lib'] },
          { id: 'ts-sec', title: 'TS Consumers', audience: 'technical', sources: ['side'] },
          { id: 'nb-sec', title: 'Notebook Analysis', audience: 'technical', sources: ['nb'] },
          { id: 'ddl-sec', title: 'SQL Contracts', audience: 'technical', sources: ['ddl'] },
        ],
        sources: [
          { id: 'lib', path: 'src/lib.mts', description: 'Shared TS lib' },
          { id: 'side', path: 'src/side.ts', description: 'Side-effect & dynamic consumer' },
          { id: 'nb', path: 'notebooks/analysis.ipynb', description: 'Notebook consumer' },
          { id: 'ddl', path: 'sql/tables.sql', description: 'SQL DDL' },
        ],
      }),
    );
    await fs.writeFile(
      path.join(docs, 'content.md'),
      '## Base Lib\n\nL.\n\n## TS Consumers\n\nT.\n\n## Notebook Analysis\n\nN.\n\n## SQL Contracts\n\nD.\n',
    );
    await build(path.join(docs, 'document.json'), path.join(docs, 'out.html'));

    await fs.writeFile(path.join(dir, 'src/lib.mts'), 'export const VAL = 99;\n');
    const impact = await analyzeImpact(
      path.join(docs, 'document.json'),
      path.join(docs, 'out.validation.json'),
      { dossierFile: outJson },
    );
    assert.equal(impact.ok, false);
    assert.deepEqual(impact.impactedPaths.direct, ['src/lib.mts']);
    assert.ok(impact.impactedPaths.transitive.includes('src/reexport.mts'));
    assert.ok(impact.impactedPaths.transitive.includes('src/side.ts'));
    assert.deepEqual(
      impact.impactedSections.map((s) => s.id),
      ['lib-sec', 'ts-sec'],
    );
    assert.deepEqual(
      impact.freshSections.map((s) => s.id),
      ['nb-sec', 'ddl-sec'],
    );
  }));




