from datetime import datetime


class GrievanceCase:
    """Formal grievance case model linked to worker profile and welfare records."""

    ISSUE_CATEGORY_CHOICES = [
        'Salary Dispute',
        'Health',
        'Employer Conflict',
        'Food/Housing'
    ]

    SEVERITY_LEVEL_CHOICES = [
        'Low',
        'Medium',
        'High'
    ]

    RESOLUTION_STATUS_CHOICES = [
        'Open',
        'In-Progress',
        'Resolved',
        'Repatriated'
    ]

    def __init__(
        self,
        case_id,
        worker_id,
        issue_category,
        severity_level,
        current_action,
        resolution_status='Open',
        created_at=None,
        updated_at=None
    ):
        self.case_id = case_id
        self.worker_id = worker_id
        self.issue_category = issue_category
        self.severity_level = severity_level
        self.current_action = current_action
        self.resolution_status = resolution_status
        self.created_at = created_at or datetime.now()
        self.updated_at = updated_at or datetime.now()

        self._validate_fields()

    def _validate_fields(self):
        if self.issue_category not in self.ISSUE_CATEGORY_CHOICES:
            raise ValueError(f"Invalid Issue_Category: {self.issue_category}")
        if self.severity_level not in self.SEVERITY_LEVEL_CHOICES:
            raise ValueError(f"Invalid Severity_Level: {self.severity_level}")
        if self.resolution_status not in self.RESOLUTION_STATUS_CHOICES:
            raise ValueError(f"Invalid Resolution_Status: {self.resolution_status}")

    def to_dict(self):
        return {
            'case_id': self.case_id,
            'worker_id': self.worker_id,
            'issue_category': self.issue_category,
            'severity_level': self.severity_level,
            'current_action': self.current_action,
            'resolution_status': self.resolution_status,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    def update_action(self, action_text):
        self.current_action = action_text
        self.updated_at = datetime.now()

    def update_resolution(self, new_status):
        if new_status not in self.RESOLUTION_STATUS_CHOICES:
            raise ValueError(f"Invalid Resolution_Status: {new_status}")
        self.resolution_status = new_status
        self.updated_at = datetime.now()

    def is_emergency(self):
        return self.severity_level == 'High'


def generate_case_id(sequence_number):
    """Generate a formatted Case_ID like BOR-WEL-2026-0001."""
    return f"BOR-WEL-2026-{sequence_number:04d}"


def escalate_welfare_to_grievance(welfare_report, sequence_number):
    """Convert a welfare incident report into a formal grievance case."""
    return GrievanceCase(
        case_id=generate_case_id(sequence_number),
        worker_id=welfare_report.get('worker_id'),
        issue_category=welfare_report.get('issue_category', 'Employer Conflict'),
        severity_level=welfare_report.get('severity_level', 'Medium'),
        current_action=welfare_report.get('current_action', 'Escalated from welfare monitoring.'),
        resolution_status='Open'
    )
