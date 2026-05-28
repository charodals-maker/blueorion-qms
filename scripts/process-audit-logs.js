#!/usr/bin/env node
/**
 * Audit Log Processing Script for BLUEORION QMS
 * Processes, validates, and fixes audit logs from provided data
 * Usage: node scripts/process-audit-logs.js
 */

const AuditLogProcessor = require('../modules/audit-log-processor');

// Raw audit logs provided by user
const RAW_LOGS = [
  "4/27/2026, 7:47:23 PM\tunknown\tapplication-submitted\t{\"id\": \"APP-1777290443391\", \"name\": \"Tayah, Jaypyner Omar\"}",
  "4/27/2026, 8:08:37 PM\tunknown\tapplication-submitted\t{\"id\": \"APP-1777291717241\", \"name\": \"MORO, CECILE MAE ADAME\"}",
  "4/27/2026, 8:19:59 PM\tcharo\tlogin-success\t{\"username\": \"charo\", \"ip\": \"27.49.19.2, 172.71.87.140, 10.196.14.132\"}",
  "4/27/2026, 8:20:59 PM\tcharo\tlogin-success\t{\"username\": \"charo\", \"ip\": \"27.49.19.2, 172.71.87.140, 10.196.6.130\"}"
];

// Parse logs to proper format (fix date/time format)
const PROCESSED_LOGS = [
  {
    date: "4/27/2026",
    time: "7:47:23 PM",
    user: "unknown",
    action: "application-submitted",
    details: { id: "APP-1777290443391", name: "Tayah, Jaypyner Omar" }
  },
  {
    date: "4/27/2026",
    time: "8:08:37 PM",
    user: "unknown",
    action: "application-submitted",
    details: { id: "APP-1777291717241", name: "MORO, CECILE MAE ADAME" }
  },
  {
    date: "4/27/2026",
    time: "8:19:59 PM",
    user: "charo",
    action: "login-success",
    details: { username: "charo", ip: "27.49.19.2, 172.71.87.140, 10.196.14.132" }
  },
  {
    date: "4/27/2026",
    time: "8:20:59 PM",
    user: "charo",
    action: "login-success",
    details: { username: "charo", ip: "27.49.19.2, 172.71.87.140, 10.196.6.130" }
  }
];

/**
 * Main processing function
 */
async function processAuditLogs() {
  console.log('🔍 BLUEORION QMS Audit Log Processor');
  console.log('='.repeat(60));
  
  const processor = new AuditLogProcessor();
  
  console.log('\n📋 Input Logs:');
  console.log(`Total entries to process: ${PROCESSED_LOGS.length}`);
  
  // Process logs
  console.log('\n⚙️  Processing logs...');
  const result = processor.processEntries(PROCESSED_LOGS);
  
  console.log('\n✅ Processing Complete!');
  console.log('='.repeat(60));
  console.log('\n📊 Results:');
  console.log(`  ✓ Successful: ${result.successful}`);
  console.log(`  ✗ Failed: ${result.failed}`);
  console.log(`  ⚠️  Fixed Errors: ${result.fixedErrors}`);
  console.log(`  ⚠️  Warnings: ${result.warnings}`);
  
  // Show detailed results
  if (result.details.length > 0) {
    console.log('\n⚠️  Processing Details:');
    for (const detail of result.details) {
      console.log(`  Entry ${detail.index}: ${detail.status}`);
      if (detail.errors) {
        console.log(`    Errors: ${detail.errors.join(', ')}`);
      }
      if (detail.error) {
        console.log(`    Error: ${detail.error}`);
      }
    }
  }
  
  // Display processed entries
  console.log('\n📝 Processed Entries:');
  const logger = processor.getLogger();
  const recentEvents = logger.getRecentEvents(10);
  
  for (const event of recentEvents) {
    console.log(`\n  [${event.category}] ${event.timestamp}`);
    console.log(`    User: ${event.user}`);
    console.log(`    Action: ${event.action}`);
    console.log(`    Severity: ${event.severity}`);
    console.log(`    IP: ${event.ip}`);
    if (Object.keys(event.details).length > 0) {
      console.log(`    Details: ${JSON.stringify(event.details)}`);
    }
  }
  
  // Get statistics
  const stats = processor.getStats();
  console.log('\n📈 Statistics:');
  console.log(`  Total Processed: ${stats.processed}`);
  console.log(`  Total Errors: ${stats.errors}`);
  console.log(`  Audit Events Logged: ${stats.auditStats.total}`);
  
  console.log('\n📊 Events by Category:');
  for (const [category, count] of Object.entries(stats.auditStats.byType)) {
    console.log(`  ${category}: ${count}`);
  }
  
  console.log('\n👥 Events by User:');
  for (const [user, count] of Object.entries(stats.auditStats.byUser)) {
    console.log(`  ${user}: ${count}`);
  }
  
  // Export logs
  console.log('\n💾 Exporting logs...');
  const jsonExport = processor.exportLogs('json', './logs/audit-export.json');
  const csvExport = processor.exportLogs('csv', './logs/audit-export.csv');
  
  console.log(`  ${jsonExport.success ? '✓' : '✗'} JSON: ${jsonExport.filename || jsonExport.error}`);
  console.log(`  ${csvExport.success ? '✓' : '✗'} CSV: ${csvExport.filename || csvExport.error}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Audit log processing completed successfully!');
  console.log('Logs saved to: ./logs/');
}

// Run processor
if (require.main === module) {
  processAuditLogs().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { processAuditLogs };
