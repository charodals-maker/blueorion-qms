from datetime import datetime, date


class ReEngagement:
    """Model for re-engaging returning workers for new deployment."""

    def __init__(
        self,
        re_id,
        worker_id,
        previous_country,
        performance_rating,
        finish_contract_date,
        ready_to_deploy,
        preferred_job
    ):
        self.re_id = re_id
        self.worker_id = worker_id
        self.previous_country = previous_country
        self.performance_rating = performance_rating
        self.finish_contract_date = finish_contract_date
        self.ready_to_deploy = ready_to_deploy
        self.preferred_job = preferred_job

    def to_dict(self):
        return {
            're_id': self.re_id,
            'worker_id': self.worker_id,
            'previous_country': self.previous_country,
            'performance_rating': self.performance_rating,
            'finish_contract_date': self.finish_contract_date,
            'ready_to_deploy': self.ready_to_deploy,
            'preferred_job': self.preferred_job
        }

    def is_high_value_candidate(self, worker_status):
        """Flag candidates for priority sourcing when they finished contract successfully."""
        return self.performance_rating >= 4 and worker_status == 'Finished Contract'

    def needs_document_update(self, passport_expiry, nbi_clearance_valid_until, oec_exemption_possible):
        """Return a document checklist for re-engagement processing."""
        today = date.today()
        checklist = {
            'passport_expiry': passport_expiry,
            'passport_expiring_soon': passport_expiry <= today,
            'nbi_clearance_needed': nbi_clearance_valid_until <= today,
            'oec_exemption_possible': oec_exemption_possible
        }
        return checklist


def generate_reengagement_id(sequence_number):
    """Generate a formatted Re_ID like BOR-RE-2026-0001."""
    return f"BOR-RE-2026-{sequence_number:04d}"
