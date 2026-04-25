from datetime import datetime, date


class SelectionMatch:
    """Selection & CV model for matching workers to Job Orders."""

    STATUS_CHOICES = [
        'Pending',
        'Submitted to Employer',
        'Selected',
        'Rejected'
    ]

    def __init__(
        self,
        match_id,
        worker_id,
        jo_number,
        cv_status='Pending',
        interview_date=None,
        selection_date=None
    ):
        self.match_id = match_id
        self.worker_id = worker_id
        self.jo_number = jo_number
        self.cv_status = cv_status
        self.interview_date = interview_date
        self.selection_date = selection_date

        self._validate_status()

    def _validate_status(self):
        if self.cv_status not in self.STATUS_CHOICES:
            raise ValueError(f"Invalid CV_Status: {self.cv_status}")

    def to_dict(self):
        return {
            'match_id': self.match_id,
            'worker_id': self.worker_id,
            'jo_number': self.jo_number,
            'cv_status': self.cv_status,
            'interview_date': self.interview_date,
            'selection_date': self.selection_date
        }

    def is_selected(self):
        return self.cv_status == 'Selected'

    def update_status(self, new_status):
        if new_status not in self.STATUS_CHOICES:
            raise ValueError(f"Invalid CV_Status: {new_status}")

        self.cv_status = new_status
        if new_status == 'Selected' and self.selection_date is None:
            self.selection_date = date.today()

    def schedule_interview(self, interview_datetime):
        self.interview_date = interview_datetime

    def integration_actions(self):
        """Return integration actions when a candidate is selected."""
        if not self.is_selected():
            return None

        return {
            'payment_voucher': create_medical_payment_entry(self),
            'document_control_alert': alert_document_control_for_contract(self)
        }


def generate_match_id(sequence_number):
    """Generate a formatted Match_ID like SEL-2026-0001."""
    return f"SEL-2026-{sequence_number:04d}"


def create_medical_payment_entry(selection_match):
    """Create a payment voucher entry for medical exam processing."""
    return {
        'reference_id': selection_match.match_id,
        'worker_id': selection_match.worker_id,
        'job_order': selection_match.jo_number,
        'payment_type': 'Medical Exam',
        'status': 'Pending',
        'created_at': datetime.now().isoformat()
    }


def alert_document_control_for_contract(selection_match):
    """Alert Document Control to start the DMW contract when a worker is selected."""
    return {
        'reference_id': selection_match.match_id,
        'worker_id': selection_match.worker_id,
        'job_order': selection_match.jo_number,
        'action': 'Start DMW contract',
        'triggered_at': datetime.now().isoformat()
    }
