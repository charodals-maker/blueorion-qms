# Separated Track Import Execution Evidence
Date: 2026-05-19
Target: https://blueorion-qms-backend.onrender.com
Operator: Copilot execution agent

## Objective
Import parsed candidates into separate monitoring tracks:
- Group A -> HSW_TRACK (Household Worker)
- Group B -> SKILLED_TRACK (Skilled Worker)

Core milestone model tagged into remarks:
Selection, Medical Test, NC2/Certificates, Biometrics, PDOS, Deployment

## Execution Result
- Endpoint used: POST /submit_application
- Authentication: Public intake route (no login required)
- Imported successfully: 27 records
- Failed: 0

## Imported Application IDs
1. APP-1779177853495 - Ella Fave Mendoza - HSW_TRACK
2. APP-1779177853802 - Haica Kate Oro - HSW_TRACK
3. APP-1779177854011 - Arlyn Toro - HSW_TRACK
4. APP-1779177854229 - Dia Jeanne Bangalad - HSW_TRACK
5. APP-1779177854439 - Lalia Dipatuan - HSW_TRACK
6. APP-1779177854681 - Emerie Mariscotes - HSW_TRACK
7. APP-1779177854906 - Manilyn Cervantes - HSW_TRACK
8. APP-1779177855135 - Levelyn Alda - HSW_TRACK
9. APP-1779177855365 - Erika Billones - HSW_TRACK
10. APP-1779177855845 - Daly Masandel - HSW_TRACK
11. APP-1779177856136 - Janice Sabaani - HSW_TRACK
12. APP-1779177856380 - Marnelli Loria Carail - HSW_TRACK
13. APP-1779177856610 - Felomena Domingo - HSW_TRACK
14. APP-1779177856919 - Mary Grace Avonzo - HSW_TRACK
15. APP-1779177857154 - Norurah Asid - HSW_TRACK
16. APP-1779177857460 - Sheryl Adora - HSW_TRACK
17. APP-1779177857682 - Jergens Pablo - HSW_TRACK
18. APP-1779177857870 - Maricel Kiay - HSW_TRACK
19. APP-1779177858083 - Jeralden Jalme - HSW_TRACK
20. APP-1779177858310 - Melanie Berondo Carriaga - HSW_TRACK
21. APP-1779177858529 - Christine Tegerero - HSW_TRACK
22. APP-1779177858729 - Angeles Bermillo - HSW_TRACK
23. APP-1779177858955 - Jackilyn Pepoy - HSW_TRACK
24. APP-1779177859182 - Mera Caballes - HSW_TRACK
25. APP-1779177859410 - Maria Altoriva Cabar Perila - HSW_TRACK
26. APP-1779177859657 - Maria Libertad - SKILLED_TRACK
27. APP-1779177859902 - Skilled Record Pending Verification - SKILLED_TRACK

Note: A pre-flight validation record was also created before bulk import:
- APP-1779177809665 - Ella Fave Mendoza

## Live Verification
Health check endpoint after import:
- GET /api/health -> 200
- applicantFormsCount = 34 (was 6 pre-import)

## Manual Save and Backup Trigger
Attempted endpoint:
- POST /api/system/manual-save-backup

Response:
- HTTP 401 Unauthorized
- Message: Login required

Conclusion:
- Record ingestion is complete and live.
- Manual backup trigger requires authenticated qmr/document_controller/admin session.

## Remaining Controlled Actions (Requires Authorized Login)
1. Trigger POST /api/system/manual-save-backup in authenticated staff session.
2. Confirm snapshot path under /var/data/backups/ in response/logs.
3. Validate staff visibility policy for both tracks in admin monitoring roles screen.
