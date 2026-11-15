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

