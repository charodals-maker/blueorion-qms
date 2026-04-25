import json
import hashlib
import hmac
import secrets
import sys


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 120000).hex()


USERS = {
    'charo': {
        'full_name': 'Charo D. Alaasdi',
        'user_role': 'president',
        'allowed_modules': 'all',
        'must_change_password': False,
        'salt': 'bo-charo-legacy',
        'password_hash': hash_password('123', 'bo-charo-legacy')
    },
    'president.blueorion': {
        'full_name': 'Blueorion President',
        'user_role': 'president',
        'allowed_modules': 'all',
        'must_change_password': False,
        'salt': 'bo-pres-2026',
        'password_hash': hash_password('Blue@President2026', 'bo-pres-2026')
    },
    'charo.president': {
        'full_name': 'President Charo',
        'user_role': 'president',
        'allowed_modules': 'all',
        'must_change_password': False,
        'salt': 'bo-charo-president-2026',
        'password_hash': hash_password('BlueOrion@2026', 'bo-charo-president-2026')
    },
    'manager.operations': {
        'full_name': 'Operations Manager',
        'user_role': 'manager',
        'allowed_modules': [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 14, 15, 16, 17],
        'must_change_password': True,
        'salt': 'bo-mgr-2026',
        'password_hash': hash_password('Blue@Manager2026', 'bo-mgr-2026')
    },
    'blueorion.ops': {
        'full_name': 'Lyndie (Ops)',
        'user_role': 'manager',
        'allowed_modules': [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 17],
        'must_change_password': True,
        'salt': 'bo-ops-2026',
        'password_hash': hash_password('Blue@2026!L', 'bo-ops-2026')
    },
    'lyndie': {
        'full_name': 'Lyndie B. Jamias',
        'user_role': 'manager',
        'allowed_modules': [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 17],
        'must_change_password': True,
        'salt': 'bo-lyndie-2026',
        'password_hash': hash_password('Blue@Lyndie2026', 'bo-lyndie-2026')
    },
    'recruitment.lead': {
        'full_name': 'Recruitment Lead',
        'user_role': 'encoder',
        'allowed_modules': [2, 10, 11],
        'must_change_password': True,
        'salt': 'bo-rec-2026',
        'password_hash': hash_password('Blue@Recruitment2026', 'bo-rec-2026')
    },
    'welfare.officer': {
        'full_name': 'Welfare Officer',
        'user_role': 'welfare_lo',
        'allowed_modules': [1, 3, 15],
        'must_change_password': True,
        'salt': 'bo-wel-2026',
        'password_hash': hash_password('Blue@Welfare2026', 'bo-wel-2026')
    },
    'blueorion_staff01': {
        'staff_id': 'BOR-2026-001',
        'full_name': 'Malate Screening Staff',
        'office_location': 'Malate Headquarters (Atlantis Beacon Tower)',
        'user_role': 'encoder',
        'allowed_modules': [2, 10, 11],
        'must_change_password': True,
        'salt': 'bo-malate-001',
        'password_hash': hash_password('BlueorionStart2026!', 'bo-malate-001')
    },
    'finance.accounting': {
        'full_name': 'Accounting Officer',
        'user_role': 'accounting',
        'allowed_modules': [8, 9, 13],
        'must_change_password': True,
        'salt': 'bo-fin-2026',
        'password_hash': hash_password('Blue@Accounting2026', 'bo-fin-2026')
    },
    'jenny': {
        'full_name': 'Jenny (Cashier)',
        'user_role': 'accounting',
        'allowed_modules': [9, 13],
        'must_change_password': True,
        'salt': 'bo-jenny-2026',
        'password_hash': hash_password('Blue@Jenny2026', 'bo-jenny-2026')
    },
    'geneve': {
        'full_name': 'Geneve (Document Control)',
        'user_role': 'encoder',
        'allowed_modules': [10, 11],
        'must_change_password': True,
        'salt': 'bo-geneve-2026',
        'password_hash': hash_password('Blue@Geneve2026', 'bo-geneve-2026')
    },
    'eman': {
        'full_name': 'Emmanuel Carbonilla',
        'user_role': 'manager',
        'allowed_modules': [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 17],
        'must_change_password': False,
        'salt': 'bo-eman-2026',
        'password_hash': hash_password('Blue@Eman2026', 'bo-eman-2026')
    },
    'blueorion.sg': {
        'full_name': 'Shekainah Gavina',
        'user_role': 'staff',
        'allowed_modules': [2, 10, 11, 17],
        'must_change_password': True,
        'salt': 'bo-shekainah-2026',
        'password_hash': hash_password('Blue@2026!S', 'bo-shekainah-2026')
    }
}


def authenticate(username, password):
    profile = USERS.get(username)
    if not profile:
        return {'authenticated': False}

    actual_hash = hash_password(password, profile['salt'])
    if not hmac.compare_digest(actual_hash, profile['password_hash']):
        return {'authenticated': False}

    return {
        'authenticated': True,
        'username': username,
        'staff_id': profile.get('staff_id'),
        'full_name': profile.get('full_name'),
        'office_location': profile.get('office_location'),
        'user_role': profile['user_role'],
        'allowed_modules': profile['allowed_modules'],
        'must_change_password': profile['must_change_password']
    }


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({'authenticated': False}))
        raise SystemExit(0)

    user = sys.argv[1]
    passwd = sys.argv[2]
    print(json.dumps(authenticate(user, passwd)))
