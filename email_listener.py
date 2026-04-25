from datetime import datetime
import json
import os
import re

EMAIL_LOG_FILE = os.path.join(os.path.dirname(__file__), 'email_listener_log.json')

WATCH_INBOXES = {
    'blueorionapply@yahoo.com': {
        'systems': [2, 11],
        'tag': 'Applicant Intake',
        'rule': 'Attach applicant CVs to System #11 and feed System #2 pipeline.'
    },
    'blueorionrecruitment@gmail.com': {
        'systems': [6],
        'tag': 'Partner Inquiry',
        'rule': 'Flag FRA / Partner communication and route to System #6.'
    }
}

MOCK_EMAILS = [
    {
        'to': 'Blueorionapply@yahoo.com',
        'from': 'juan.delacruz@yahoo.com',
        'subject': 'TEST: Juan Dela Cruz - Skilled Labor',
        'body': 'Good day. I am Juan Dela Cruz applying for Skilled Labor. Contact: +63 917 123 4501',
        'attachments': ['Juan_Dela_Cruz_CV.pdf'],
        'received_at': '2026-04-14T14:05:00'
    },
    {
        'to': 'Blueorionrecruitment@gmail.com',
        'from': 'partner@riyadhagency.com',
        'subject': 'Saudi Partner Inquiry for new manpower requirement',
        'body': 'We would like to discuss a new manpower request for 25 workers.',
        'attachments': [],
        'received_at': '2026-04-14T14:20:00'
    }
]


def load_existing_log():
    if not os.path.exists(EMAIL_LOG_FILE):
        return []
    with open(EMAIL_LOG_FILE, 'r', encoding='utf-8') as handle:
        try:
            return json.load(handle)
        except json.JSONDecodeError:
            return []


def save_log(records):
    with open(EMAIL_LOG_FILE, 'w', encoding='utf-8') as handle:
        json.dump(records, handle, indent=2)


def extract_candidate_name(subject, body):
    test_subject_match = re.match(r'^\s*test\s*:\s*([^\-]+)\-', subject, re.IGNORECASE)
    if test_subject_match:
        return test_subject_match.group(1).strip()

    subject_match = re.match(r'([A-Za-z .]+)\s*-', subject)
    if subject_match:
        return subject_match.group(1).strip()

    body_match = re.search(r'I am\s+([A-Za-z ]+)', body, re.IGNORECASE)
    if body_match:
        return body_match.group(1).strip()

    return 'Unknown Applicant'


def extract_job_interest(subject, body):
    test_subject_match = re.match(r'^\s*test\s*:\s*[^\-]+\-\s*(.+)$', subject, re.IGNORECASE)
    if test_subject_match:
        return test_subject_match.group(1).strip()

    combined = f'{subject} {body}'.lower()
    if 'healthcare' in combined:
        return 'Healthcare'
    if 'domestic' in combined:
        return 'Domestic Helper'
    if 'skilled' in combined:
        return 'Skilled Labor'
    return 'General Application'


def extract_contact_number(body):
    match = re.search(r'(\+?\d[\d \-]{8,})', body)
    return match.group(1).strip() if match else 'Not provided'


def route_email(email_message):
    inbox = str(email_message.get('to', '')).strip().lower()
    rule = WATCH_INBOXES.get(inbox)
    if not rule:
        return None

    if inbox == 'blueorionapply@yahoo.com':
        return {
            'received_at': email_message['received_at'],
            'source_inbox': inbox,
            'source_sender': email_message['from'],
            'candidate_name': extract_candidate_name(email_message.get('subject', ''), email_message.get('body', '')),
            'job_interest': extract_job_interest(email_message.get('subject', ''), email_message.get('body', '')),
            'contact_number': extract_contact_number(email_message.get('body', '')),
            'status': 'New Lead',
            'systems': rule['systems'],
            'routing_tag': rule['tag'],
            'cv_attachment': email_message['attachments'][0] if email_message.get('attachments') else None,
            'action': 'Attached CV to System #11 and queued lead in System #2'
        }

    return {
        'received_at': email_message['received_at'],
        'source_inbox': inbox,
        'source_sender': email_message['from'],
        'candidate_name': 'Partner / FRA Contact',
        'job_interest': 'Partner Inquiry',
        'contact_number': 'Email only',
        'status': 'Partner Inquiry',
        'systems': rule['systems'],
        'routing_tag': rule['tag'],
        'cv_attachment': None,
        'action': 'Flagged and sent to System #6 (FRA / Partner)'
    }


def watch_recruitment_emails(email_messages=None):
    email_messages = email_messages or MOCK_EMAILS
    routed = []

    for message in email_messages:
        record = route_email(message)
        if record:
            routed.append(record)

    existing = load_existing_log()
    combined = existing + routed
    save_log(combined)
    return routed


if __name__ == '__main__':
    routed_records = watch_recruitment_emails()
    print(json.dumps({
        'run_at': datetime.now().isoformat(),
        'processed': len(routed_records),
        'records': routed_records
    }, indent=2))
