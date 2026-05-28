"""
auto_audit.py
System #7 – Automated Self-Audit Scanner
Runs every Friday at 17:00 (via Task Scheduler / cron).

What it scans
-------------
1. Open grievance cases older than 48 hours             → WARNING
2. Expiring worker insurance (within 30 days)            → WARNING
3. Workers with missing OEC in System #14               → CRITICAL
4. Staff training records not updated in 90+ days       → INFO
5. Workers deployed without valid insurance (#14 × #16) → CRITICAL

Results are appended to audit_log.json and printed to stdout.
Schedule with:
  Windows Task Scheduler → Action: python auto_audit.py
  Linux cron:  0 17 * * 5 /usr/bin/python3 /app/auto_audit.py
"""

import json
import os
from datetime import datetime, timedelta

from models_audit import AuditRecord, generate_audit_id, SYSTEM_CHOICES

# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------

AUDIT_LOG_FILE = os.path.join(os.path.dirname(__file__), 'audit_log.json')
TODAY = datetime.now().date()
EXPIRY_WINDOW_DAYS = 30
GRIEVANCE_FOLLOWUP_HOURS = 48
TRAINING_STALE_DAYS = 90


# ------------------------------------------------------------------
# Mock data loaders
# Replace these with real DB/API calls once MongoDB endpoints are live
# ------------------------------------------------------------------

def load_welfare_cases():
    """Return list of open welfare case dicts from in-memory mock."""
    return [
        {
            'case_id': 'BOR-WEL-2026-0001',
            'worker_id': 'W-1001',
            'issue_category': 'Salary Dispute',
            'severity_level': 'High',
            'resolution_status': 'Open',
            'created_at': (datetime.now() - timedelta(hours=50)).isoformat(),
        },
        {
            'case_id': 'BOR-WEL-2026-0002',
            'worker_id': 'W-1002',
            'issue_category': 'Food/Housing',
            'severity_level': 'Medium',
            'resolution_status': 'In-Progress',
            'created_at': (datetime.now() - timedelta(hours=24)).isoformat(),
        },
    ]


def load_insurance_policies():
    """Return list of insurance policy dicts."""
    return [
        {'policy_id': 'INS-2026-001', 'worker_id': 'W-1001',
         'expiry': (TODAY + timedelta(days=10)).isoformat()},
        {'policy_id': 'INS-2026-002', 'worker_id': 'W-1002',
         'expiry': (TODAY + timedelta(days=60)).isoformat()},
        {'policy_id': 'INS-2026-003', 'worker_id': 'W-1003',
         'expiry': (TODAY + timedelta(days=5)).isoformat()},
    ]


def load_deployment_records():
    """Return list of scheduled deployment records."""
    return [
        {'dep_id': 'DEP-2026-0001', 'worker_id': 'W-1001',
         'oec_status': 'Missing', 'flight_schedule': (TODAY + timedelta(days=1)).isoformat(),
         'insurance_status': 'Active'},
        {'dep_id': 'DEP-2026-0002', 'worker_id': 'W-1002',
         'oec_status': 'Complete', 'flight_schedule': (TODAY + timedelta(days=10)).isoformat(),
         'insurance_status': 'Missing'},
        {'dep_id': 'DEP-2026-0003', 'worker_id': 'W-1003',
         'oec_status': 'Complete', 'flight_schedule': (TODAY + timedelta(days=4)).isoformat(),
         'insurance_status': 'Expired'},
    ]


def load_resource_competence():
    """Return list of staff competence records."""
    return [
        {'resource_id': 'BOR-RC-2026-0001', 'username': 'staff.sourcing',
         'last_training_update': (TODAY - timedelta(days=95)).isoformat()},
        {'resource_id': 'BOR-RC-2026-0002', 'username': 'manager.operations',
         'last_training_update': (TODAY - timedelta(days=30)).isoformat()},
    ]


# ------------------------------------------------------------------
# Scan rules
# ------------------------------------------------------------------

def scan_overdue_grievances(welfare_cases, sequence_start):
    """Rule 1: Open welfare cases > 48 hours without resolution."""
    findings = []
    seq = sequence_start
    for case in welfare_cases:
        if case['resolution_status'] not in ('Open', 'In-Progress'):
            continue
        opened = datetime.fromisoformat(case['created_at'])
        hours_elapsed = (datetime.now() - opened).total_seconds() / 3600
        if hours_elapsed > GRIEVANCE_FOLLOWUP_HOURS:
            record = AuditRecord(
                audit_id=generate_audit_id(seq),
                system_affected='System #15 – Welfare Emergency',
                findings=(
                    f"Case {case['case_id']} (Worker {case['worker_id']}) has been "
                    f"'{case['resolution_status']}' for {hours_elapsed:.0f} hours "
                    f"without resolution. Severity: {case['severity_level']}."
                ),
                raised_by='auto_audit.py',
                target_closure=TODAY + timedelta(days=1),
            )
            findings.append(record)
            seq += 1
    return findings, seq


def scan_expiring_insurance(policies, sequence_start):
    """Rule 2: Insurance expiring within EXPIRY_WINDOW_DAYS days."""
    findings = []
    seq = sequence_start
    for policy in policies:
        expiry = datetime.fromisoformat(policy['expiry']).date()
        days_left = (expiry - TODAY).days
        if 0 < days_left <= EXPIRY_WINDOW_DAYS:
            record = AuditRecord(
                audit_id=generate_audit_id(seq),
                system_affected='System #16 – Insurance',
                findings=(
                    f"Policy {policy['policy_id']} for Worker {policy['worker_id']} "
                    f"expires on {expiry} ({days_left} days remaining). "
                    f"Renewal action required immediately."
                ),
                raised_by='auto_audit.py',
                target_closure=expiry - timedelta(days=7),
            )
            findings.append(record)
            seq += 1
    return findings, seq


def scan_missing_oec(deployment_records, sequence_start):
    """Rule 3: Workers scheduled to fly without OEC — CRITICAL."""
    findings = []
    seq = sequence_start
    for dep in deployment_records:
        flight_date = datetime.fromisoformat(dep['flight_schedule']).date()
        days_to_flight = (flight_date - TODAY).days
        if dep['oec_status'] == 'Missing' and days_to_flight <= 2:
            record = AuditRecord(
                audit_id=generate_audit_id(seq),
                system_affected='System #14 – Deployment',
                findings=(
                    f"CRITICAL: Worker {dep['worker_id']} (Deployment {dep['dep_id']}) "
                    f"is scheduled to fly in {days_to_flight} day(s) but OEC is MISSING. "
                    f"DMW compliance breach risk."
                ),
                raised_by='auto_audit.py',
                target_closure=flight_date,
            )
            findings.append(record)
            seq += 1
    return findings, seq


def scan_deployed_without_insurance(deployment_records, sequence_start):
    """
    Rule 5 – perform_internal_audit (System #14 × System #16 cross-check).
    Flag any worker who has been matched to a deployment record but whose
    insurance_status is 'Missing' or 'Expired'.
    This implements the Automatic System Check requested for Blueorion:
        SELECT * FROM deployment WHERE insurance_status IN ('Missing', 'Expired')
    """
    findings = []
    seq = sequence_start
    for dep in deployment_records:
        ins_status = dep.get('insurance_status', 'Active')
        if ins_status in ('Missing', 'Expired'):
            record = AuditRecord(
                audit_id=generate_audit_id(seq),
                system_affected='System #14 – Deployment',
                findings=(
                    f"Worker {dep['worker_id']} (Deployment {dep['dep_id']}) "
                    f"is cleared for departure but insurance record shows "
                    f"'{ins_status}' in System #16. "
                    f"DMW requires valid insurance before dispatch. "
                    f"Cross-link System #16 and update before flight date."
                ),
                corrective_action=(
                    'Contact insurance coordinator to issue or renew policy. '
                    'Upload proof to System #16 and mark insurance_status = Active.'
                ),
                verified_by='',
                raised_by='auto_audit.py',
                target_closure=TODAY + timedelta(days=2),
            )
            findings.append(record)
            seq += 1
    return findings, seq


def scan_stale_training(resource_records, sequence_start):
    """Rule 4: Staff training records not updated in 90+ days."""
    findings = []
    seq = sequence_start
    for staff in resource_records:
        last_update = datetime.fromisoformat(staff['last_training_update']).date()
        days_stale = (TODAY - last_update).days
        if days_stale >= TRAINING_STALE_DAYS:
            record = AuditRecord(
                audit_id=generate_audit_id(seq),
                system_affected='System #5 – Resource & Competence',
                findings=(
                    f"Staff '{staff['username']}' (ID: {staff['resource_id']}) "
                    f"training record has not been updated in {days_stale} days. "
                    f"ISO 9001 Clause 7.2 requires up-to-date competence records."
                ),
                raised_by='auto_audit.py',
                target_closure=TODAY + timedelta(days=14),
            )
            findings.append(record)
            seq += 1
    return findings, seq


# ------------------------------------------------------------------
# Report writer
# ------------------------------------------------------------------

def load_existing_log():
    if not os.path.exists(AUDIT_LOG_FILE):
        return []
    with open(AUDIT_LOG_FILE, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def save_log(records):
    with open(AUDIT_LOG_FILE, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2, default=str)


def print_summary(new_findings):
    divider = '=' * 62
    print(divider)
    print(f'  BLUEORION QMS AUTO-AUDIT  —  {TODAY}  (Every Friday 17:00)')
    print(divider)
    if not new_findings:
        print('  ✅  No new non-conformities found. System is compliant.')
    else:
        print(f'  ⚠️  {len(new_findings)} new finding(s) logged:\n')
        for finding in new_findings:
            print(f'  [{finding.audit_id}]  {finding.system_affected}')
            print(f'  → {finding.findings[:100]}...' if len(finding.findings) > 100
                  else f'  → {finding.findings}')
            print()
    print(divider)


# ------------------------------------------------------------------
# Entry point
# ------------------------------------------------------------------

def run_auto_audit():
    today_is_friday = datetime.now().weekday() == 4  # Monday=0, Friday=4

    existing_log = load_existing_log()
    next_seq = len(existing_log) + 1

    all_new_findings = []

    welfare = load_welfare_cases()
    policies = load_insurance_policies()
    deployments = load_deployment_records()
    resources = load_resource_competence()

    grievance_findings, next_seq = scan_overdue_grievances(welfare, next_seq)
    insurance_findings, next_seq = scan_expiring_insurance(policies, next_seq)
    oec_findings, next_seq = scan_missing_oec(deployments, next_seq)
    training_findings, next_seq = scan_stale_training(resources, next_seq)
    ins_cross_findings, next_seq = scan_deployed_without_insurance(deployments, next_seq)

    all_new_findings.extend(grievance_findings)
    all_new_findings.extend(insurance_findings)
    all_new_findings.extend(oec_findings)
    all_new_findings.extend(training_findings)
    all_new_findings.extend(ins_cross_findings)

    new_dicts = [r.to_dict() for r in all_new_findings]
    combined = existing_log + new_dicts
    save_log(combined)

    print_summary(all_new_findings)

    total = len(combined)
    closed = sum(1 for r in combined if r.get('status') == 'Closed')
    score = round((closed / total) * 100, 2) if total else 100.0
    print(f'  📊  Compliance Score  :  {score}% ({closed}/{total} closed)')

    open_count = total - closed
    print(f'  🔓  Open Findings     :  {open_count}')
    print(f'  📁  Log saved to      :  {AUDIT_LOG_FILE}')
    print()

    return all_new_findings


if __name__ == '__main__':
    run_auto_audit()
