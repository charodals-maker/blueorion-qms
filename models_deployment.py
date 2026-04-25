from datetime import datetime


class DeploymentRecord:
    """Tracks the final deployment steps for a worker profile."""

    STATUS_CHOICES = [
        'Scheduled',
        'At Airport',
        'Deployed',
        'Cancelled'
    ]


    def __init__(
        self,
        deployment_id,
        worker_id,
        oec_number,
        pdos_status=False,
        airline=None,
        flight_schedule=None,
        airport_staff=None,
        deployment_status='Scheduled',
        agency=None,
        company=None,
        fra=None,
        worker_name=None,
        worker_contact=None,
        worker_address=None,
        date_deployed=None
    ):
        self.deployment_id = deployment_id
        self.worker_id = worker_id
        self.oec_number = oec_number
        self.pdos_status = bool(pdos_status)
        self.airline = airline
        self.flight_schedule = flight_schedule
        self.airport_staff = airport_staff
        self.deployment_status = deployment_status
        self.agency = agency
        self.company = company
        self.fra = fra
        self.worker_name = worker_name
        self.worker_contact = worker_contact
        self.worker_address = worker_address
        self.date_deployed = date_deployed

        self._validate_oec_number()
        self._validate_status()

    def _validate_oec_number(self):
        if not isinstance(self.oec_number, str) or not self.oec_number.strip():
            raise ValueError('OEC_Number must be a valid non-empty string.')

    def _validate_status(self):
        if self.deployment_status not in self.STATUS_CHOICES:
            raise ValueError(f"Invalid Deployment_Status: {self.deployment_status}")

    def to_dict(self):
        return {
            'deployment_id': self.deployment_id,
            'worker_id': self.worker_id,
            'oec_number': self.oec_number,
            'pdos_status': self.pdos_status,
            'airline': self.airline,
            'flight_schedule': self.flight_schedule,
            'airport_staff': self.airport_staff,
            'deployment_status': self.deployment_status,
            'agency': self.agency,
            'company': self.company,
            'fra': self.fra,
            'worker_name': self.worker_name,
            'worker_contact': self.worker_contact,
            'worker_address': self.worker_address,
            'date_deployed': self.date_deployed
        }

    def is_ready_for_boarding(self):
        return self.pdos_status and self.deployment_status == 'At Airport'

    def schedule_flight(self, flight_datetime):
        self.flight_schedule = flight_datetime

    def update_airport_staff(self, staff_name):
        self.airport_staff = staff_name

    def update_status(self, new_status):
        if new_status not in self.STATUS_CHOICES:
            raise ValueError(f"Invalid Deployment_Status: {new_status}")
        self.deployment_status = new_status

    def complete_deployment(self):
        self.deployment_status = 'Deployed'
        self._validate_status()

    def generate_placement_fee_invoice(self, agency_name, amount):
        """Generate a placement fee invoice when deployment is completed."""
        if self.deployment_status != 'Deployed':
            raise ValueError('Deployment must be marked Deployed before generating invoice.')

        return {
            'invoice_id': f'INV-2026-{self.worker_id}-{int(datetime.now().timestamp())}',
            'worker_id': self.worker_id,
            'agency_name': agency_name,
            'invoice_type': 'Placement Fee',
            'status': 'Pending',
            'amount': amount,
            'issued_at': datetime.now().isoformat(),
            'description': 'Placement fee invoice for Foreign Recruitment Agency after deployment.'
        }

    def cancel_deployment(self):
        self.deployment_status = 'Cancelled'
        self._validate_status()


def generate_deployment_id(sequence_number):
    """Generate a formatted Deployment_ID like DEP-2026-0001."""
    return f"DEP-2026-{sequence_number:04d}"


def check_deployment_readiness(worker_id, insurance_status, oec_status):
    """Return a deployment readiness string for a worker based on insurance and OEC."""
    if insurance_status == 'Active' and oec_status == 'Issued':
        return 'READY FOR DEPLOYMENT ✅'
    return 'DOCUMENTS INCOMPLETE ❌'
