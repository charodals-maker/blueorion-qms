from datetime import datetime


class ResourceCompetenceRecord:
    """Resource & Competence record aligned with ISO 9001 competency tracking."""

    SKILL_LEVEL_CHOICES = ['Beginner', 'Intermediate', 'Advanced', 'Lead']

    def __init__(
        self,
        resource_id,
        username,
        full_name,
        role,
        training_attended,
        skill_level,
        last_login_ip,
        created_at=None,
        updated_at=None
    ):
        self.resource_id = resource_id
        self.username = username
        self.full_name = full_name
        self.role = role
        self.training_attended = training_attended
        self.skill_level = skill_level
        self.last_login_ip = last_login_ip
        self.created_at = created_at or datetime.now()
        self.updated_at = updated_at or datetime.now()

        self._validate_skill_level()

    def _validate_skill_level(self):
        if self.skill_level not in self.SKILL_LEVEL_CHOICES:
            raise ValueError(f'Invalid Skill_Level: {self.skill_level}')

    def update_login_ip(self, ip_address):
        self.last_login_ip = ip_address
        self.updated_at = datetime.now()

    def update_training(self, training_text):
        self.training_attended = training_text
        self.updated_at = datetime.now()

    def to_dict(self):
        return {
            'resource_id': self.resource_id,
            'username': self.username,
            'full_name': self.full_name,
            'role': self.role,
            'training_attended': self.training_attended,
            'skill_level': self.skill_level,
            'last_login_ip': self.last_login_ip,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }


def generate_resource_id(sequence_number):
    """Generate a formatted Resource ID like BOR-RC-2026-0001."""
    return f'BOR-RC-2026-{sequence_number:04d}'
