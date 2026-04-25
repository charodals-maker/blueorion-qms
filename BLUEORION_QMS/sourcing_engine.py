import os
import time
from dataclasses import dataclass
from email.header import decode_header
from imaplib import IMAP4_SSL

POLL_INTERVAL_SECONDS = 300
KEYWORDS = ('application', 'cv', 'resume', 'skilled labor')
YAHOO_EMAIL = os.getenv('BLUEORION_YAHOO_EMAIL', 'Blueorionapply@yahoo.com')
GMAIL_EMAIL = os.getenv('BLUEORION_GMAIL_EMAIL', 'Blueorionrecruitment@gmail.com')
YAHOO_APP_PASSWORD = os.getenv('BLUEORION_YAHOO_APP_PASSWORD', 'replace-with-yahoo-app-password')
GMAIL_APP_PASSWORD = os.getenv('BLUEORION_GMAIL_APP_PASSWORD', 'replace-with-gmail-app-password')


@dataclass
class LeadEvent:
    source: str
    subject: str
    matched_keyword: str | None


def decode_subject(raw_subject):
    decoded_parts = decode_header(raw_subject or '')
    chunks = []
    for value, encoding in decoded_parts:
        if isinstance(value, bytes):
            chunks.append(value.decode(encoding or 'utf-8', errors='ignore'))
        else:
            chunks.append(value)
    return ''.join(chunks)


def find_keyword(subject_line):
    lowered = subject_line.lower()
    return next((word for word in KEYWORDS if word in lowered), None)


def scan_mailbox(host, username, app_password):
    if 'replace-with' in app_password:
        print(f'[CONFIG] Add an app password for {username} before running live polling.')
        return []

    events = []
    with IMAP4_SSL(host) as mailbox:
        mailbox.login(username, app_password)
        mailbox.select('INBOX')
        status, data = mailbox.search(None, 'UNSEEN')
        if status != 'OK':
            return events

        for mail_id in data[0].split():
            status, message_data = mailbox.fetch(mail_id, '(BODY.PEEK[HEADER.FIELDS (SUBJECT)])')
            if status != 'OK' or not message_data:
                continue
            raw_subject = message_data[0][1].decode('utf-8', errors='ignore').replace('Subject:', '').strip()
            subject = decode_subject(raw_subject)
            keyword = find_keyword(subject)
            if keyword:
                events.append(LeadEvent(source=username, subject=subject, matched_keyword=keyword))
    return events


def run_once():
    events = []
    events.extend(scan_mailbox('imap.mail.yahoo.com', YAHOO_EMAIL, YAHOO_APP_PASSWORD))
    events.extend(scan_mailbox('imap.gmail.com', GMAIL_EMAIL, GMAIL_APP_PASSWORD))

    for event in events:
        print(f'[LEAD] source={event.source} keyword={event.matched_keyword} subject={event.subject}')
        print('[NEXT] Create a new row in Selection (#11) and mirror it to Sourcing (#2).')

    if not events:
        print('[INFO] No new matching emails found in this poll cycle.')


if __name__ == '__main__':
    while True:
        run_once()
        time.sleep(POLL_INTERVAL_SECONDS)
