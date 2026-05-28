"""
models_audit.py
System #7 – Audit & Improvement (QMS)
Tracks Non-Conformities and Corrective Actions per ISO 9001.
Audit_ID format: BOR-AUD-2026-XXXX
"""

from datetime import datetime


SYSTEM_CHOICES = [
    'System #1 – Welfare Monitoring',
    'System #2 – Sourcing & Selection',
    'System #3 – Complaint & Grievance',
    'System #4 – Management & Leadership',
    'System #5 – Resource & Competence',
    'System #6 – Contract & Re-engagement',
    'System #7 – Audit & Improvement',
    'System #8 – Fra System',
    'System #9 – Selection & CV',
    'System #10 – Profile & Contact',
    'System #11 – Document Control',
    'System #12 – Audit Improvement',
    'System #13 – Payment & Invoice',
    'System #14 – Deployment',
    'System #15 – Welfare Emergency',
    'System #16 – Insurance',
    'System #17 – Payment Voucher',
]

STATUS_CHOICES = [
    'Open',
    'Pending Verification',
    'Closed',
]


class AuditRecord:
    """
    Represents one Non-Conformity found during an internal or external audit.
    
    Fields
    ------
    audit_id          : str   – Unique ID, format BOR-AUD-2026-XXXX
    system_affected   : str   – One of SYSTEM_CHOICES
    findings          : str   – Description of what went wrong
    corrective_action : str   – How the staff resolved or plans to resolve it
    verified_by       : str   – Name of verifier (e.g. "President" / "QMS Manager")
    status            : str   – One of STATUS_CHOICES
    raised_by         : str   – Username of staff who logged the non-conformity
    target_closure    : date  – Target date for full resolution
    actual_closure    : date  – Actual date closed (None while still open)
    created_at        : datetime
    updated_at        : datetime
    """

    def __init__(
        self,
        audit_id,
        system_affected,
        findings,
        corrective_action='',
        verified_by='',
        status='Open',
        raised_by='',
        target_closure=None,
        actual_closure=None,
        created_at=None,
        updated_at=None,
    ):
        self.audit_id = audit_id
        self.system_affected = system_affected
        self.findings = findings
        self.corrective_action = corrective_action
        self.verified_by = verified_by
        self.status = status
        self.raised_by = raised_by
        self.target_closure = target_closure
        self.actual_closure = actual_closure
        self.created_at = created_at or datetime.now()
        self.updated_at = updated_at or datetime.now()

        self._validate_fields()

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def _validate_fields(self):
        if self.system_affected not in SYSTEM_CHOICES:
            raise ValueError(
                f"Invalid System_Affected: '{self.system_affected}'. "
                f"Choose from: {SYSTEM_CHOICES}"
            )
        if self.status not in STATUS_CHOICES:
            raise ValueError(
                f"Invalid Status: '{self.status}'. "
                f"Choose from: {STATUS_CHOICES}"
            )

    # ------------------------------------------------------------------
    # State transitions
    # ------------------------------------------------------------------

    def add_corrective_action(self, action_text, verified_by=''):
        """Record how the error was fixed and who verified it."""
        if not action_text or not action_text.strip():
            raise ValueError("Corrective action text cannot be empty.")
        self.corrective_action = action_text.strip()
        if verified_by:
            self.verified_by = verified_by
        self.status = 'Pending Verification'
        self.updated_at = datetime.now()

    def close(self, verified_by=''):
        """Mark the non-conformity as resolved."""
        if not self.corrective_action:
            raise ValueError(
                "Cannot close without a corrective action on record."
            )
        if verified_by:
            self.verified_by = verified_by
        self.status = 'Closed'
        self.actual_closure = datetime.now().date()
        self.updated_at = datetime.now()

    def reopen(self, reason=''):
        """Reopen a closed finding if verification failed."""
        self.status = 'Open'
        self.actual_closure = None
        if reason:
            self.findings += f' [REOPENED: {reason}]'
        self.updated_at = datetime.now()

    # ------------------------------------------------------------------
    # Computed properties
    # ------------------------------------------------------------------

    @property
    def is_overdue(self):
        """True if target closure date has passed and status is not Closed."""
        if self.status == 'Closed' or self.target_closure is None:
            return False
        return datetime.now().date() > self.target_closure

    @property
    def days_open(self):
        """Number of days the finding has been open."""
        if self.status == 'Closed' and self.actual_closure:
            delta = self.actual_closure - self.created_at.date()
        else:
            delta = datetime.now().date() - self.created_at.date()
        return delta.days

    # ------------------------------------------------------------------
    # Serialisation
    # ------------------------------------------------------------------

    def to_dict(self):
        return {
            'audit_id': self.audit_id,
            'system_affected': self.system_affected,
            'findings': self.findings,
            'corrective_action': self.corrective_action,
            'verified_by': self.verified_by,
            'status': self.status,
            'raised_by': self.raised_by,
            'target_closure': str(self.target_closure) if self.target_closure else None,
            'actual_closure': str(self.actual_closure) if self.actual_closure else None,
            'days_open': self.days_open,
            'is_overdue': self.is_overdue,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }

    def __repr__(self):
        return (
            f"<AuditRecord {self.audit_id} | {self.system_affected} | "
            f"Status: {self.status}>"
        )


# ------------------------------------------------------------------
# Factory helpers
# ------------------------------------------------------------------

def generate_audit_id(sequence_number):
    """
    Generate a unique Audit ID.
    generate_audit_id(1)  →  'BOR-AUD-2026-0001'
    """
    return f"BOR-AUD-2026-{str(sequence_number).zfill(4)}"


def compliance_score(audit_records):
    """
    Return a float (0.0 – 100.0) representing what percentage of
    non-conformities have been closed.

    compliance_score([]) → 100.0
    compliance_score([open_record]) → 0.0
    """
    if not audit_records:
        return 100.0
    closed = sum(1 for r in audit_records if r.status == 'Closed')
    return round((closed / len(audit_records)) * 100, 2)


def average_fix_rate_days(audit_records):
    """
    Return the average number of days it took to close findings.
    Only considers Closed records with an actual_closure date.
    Returns None if no closed records exist.
    """
    closed_records = [
        r for r in audit_records
        if r.status == 'Closed' and r.actual_closure is not None
    ]
    if not closed_records:
        return None
    total_days = sum(r.days_open for r in closed_records)
    return round(total_days / len(closed_records), 1)


def filter_by_system(audit_records, system_label):
    """Return all audit records for a specific sub-system."""
    return [r for r in audit_records if r.system_affected == system_label]


def open_findings(audit_records):
    """Return all records that are still Open or Pending Verification."""
    return [r for r in audit_records if r.status != 'Closed']
