# Rendel Backup Routine Playbook

Use these exact messages in your chat with Rendel.

## 1) One-time setup command
Rendel, please create a new folder in our project root called qms_safe_zone. From now on, whenever I ask, I want you to copy all of our applicant lifecycle records and QMS files into this folder as a backup.

## 2) Daily end-of-work backup command
Rendel, I am finished with my QMS work for today. Please find our current applicant data file and copy it into the qms_safe_zone folder with today's date.

## 3) Before any enhancement command
Rendel, before you change any code to enhance our QMS, make a backup copy of the working file first. Then, add the new feature.

## Safety Net Summary
- Online: The changes to server-enhanced.js and render.yaml are ready. Once Render Postgres database/disk is fully live, online resets should stop.
- Local: Using this qms_safe_zone routine daily keeps a physical backup on your hard drive, even if the cloud service resets.
