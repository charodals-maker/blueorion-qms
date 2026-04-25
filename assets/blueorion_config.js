(function(root, factory) {
    const config = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = config;
    }

    if (root) {
        root.BLUEORION_CONFIG = config;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const config = {
        companyName: 'BLUEORION RECRUITMENT SERVICES CORP',
        officeLabel: 'Malate, Manila',
        address: 'Atlantis Beacon Tower, 2315 Leon Guinto St., Malate, Manila, Philippines',
        landlinePrimary: '8569-7528',
        landlineSecondary: '8565-2471',
        mobilePrimary: '+63 917 959 4226',
        mobileSecondary: '+63 966 452 0894',
        emailGeneral: 'Blueorionrecruitment@yahoo.com',
        emailPartnerGmail: 'Blueorionrecruitment@gmail.com',
        emailApply: 'Blueorionapply@yahoo.com',
        whatsappPrimary: 'https://wa.me/639179594226',
        whatsappSecondary: 'https://wa.me/639664520894',
        systemHeader: 'BLUEORION QMS | Malate, Manila | Tel: 8569-7528 | Blueorionrecruitment@gmail.com | Blueorionrecruitment@yahoo.com',
        documentFooter: 'Official Blueorion contact: Blueorionrecruitment@gmail.com | Blueorionrecruitment@yahoo.com | Blueorionapply@yahoo.com | Tel: 8569-7528 / 8565-2471',
        emailRouting: {
            'blueorionapply@yahoo.com': {
                systems: [2, 11],
                labels: ['System #2 - Sourcing', 'System #11 - Selection / CV'],
                purpose: 'Applicants, CVs, and selection pipeline'
            },
            'blueorionrecruitment@yahoo.com': {
                systems: [6, 13],
                labels: ['System #6 - FRA / Partner', 'System #13 - Payment / Invoice'],
                purpose: 'Foreign partners, FRA coordination, and billing'
            },
            'blueorionrecruitment@gmail.com': {
                systems: [6],
                labels: ['System #6 - FRA / Partner'],
                purpose: 'Partner inquiries and foreign recruitment coordination'
            }
        },
        categories: {
            frontOffice: [2, 17, 11],
            operations: [10, 6, 14, 16],
            welfare: [1, 15, 3],
            finance: [9, 13, 8],
            management: [4, 5, 7, 8, 12]
        }
    };

    config.getRouteByEmail = function(emailAddress) {
        const normalized = String(emailAddress || '').trim().toLowerCase();
        return config.emailRouting[normalized] || {
            systems: [],
            labels: [],
            purpose: 'Unmapped email source'
        };
    };

    return config;
});
function handleLogin() {
    // .trim() removes accidental spaces, .toLowerCase() ignores Caps Lock errors
    const user = document.getElementById('username').value.trim().toLowerCase();
    const pass = document.getElementById('password').value.trim();
    const error = document.getElementById('errorMessage');

    // These are your MASTER CREDENTIALS
    // Username: charo
    // Password: 123
    if (user === "charo" && pass === "123") {
        localStorage.setItem("userRole", "President");
        localStorage.setItem("userName", "Charo D. Alaasdi");
        
        // Success! Redirecting to your dashboard
        window.location.href = "dashboard.html";
    } else {
        // Show the error message
        error.style.display = "block";
        error.innerText = "⚠️ Access Denied: Check Username or Password";
    }
}
