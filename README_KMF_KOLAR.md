# KMF Kolar Dairy (KOMUL) — Document Management System

Official Document Management & e-File Noting System for **Kolar-Chikkaballapura District Co-operative Milk Producers Societies Union Ltd (KOMUL / KMF Kolar Dairy)**.

---

## ⚡ 1-Minute Quick Start for Office Staff

### 1. How to Start the System
On the main office computer:
1. Double-click the file: **`Start_KMF_DMS.bat`**
2. The system starts automatically and opens your web browser at:
   ```
   http://localhost:5188
   ```
3. To access from **other computers** in the KMF Kolar office (Accounts, Purchase, MD Cabin):
   - Find the host computer's IP address (e.g. `192.168.1.100`).
   - On other PCs, open Google Chrome and visit:
     ```
     http://192.168.1.100:5188
     ```

### 2. How to Back Up Documents & Database
To keep all files completely safe:
1. Double-click: **`Backup_KMF_DMS.bat`**
2. It creates a safe timestamped copy of the database and all uploaded bills/PDFs in the `backups\` folder.
3. You can also copy that folder to an external USB pen drive or external hard disk.

---

## 🏢 Official KMF Kolar Departments Pre-Configured

| Code | Department Name (English & Kannada) |
| :--- | :--- |
| **ACCOUNTS** | Accounts & Finance (ಲೆಕ್ಕಪತ್ರ ಮತ್ತು ಹಣಕಾಸು) |
| **PURCHASE** | Purchase & Stores (ಖರೀದಿ ಮತ್ತು ದಾಸ್ತಾನು) |
| **PRODUCTION**| Dairy Processing & Production (ಡೈರಿ ಉತ್ಪಾದನೆ ಮತ್ತು ಸಂಸ್ಕರಣೆ) |
| **QC** | Quality Control & Lab (ಗುಣಮಟ್ಟ ನಿಯಂತ್ರಣ) |
| **MARKETING** | Marketing & Sales (ಮಾರುಕಟ್ಟೆ ಮತ್ತು ಮಾರಾಟ) |
| **TRANSPORT** | Transport & Logistics (ಸಾರಿಗೆ ಮತ್ತು ವಾಹನ ವಿಭಾಗ) |
| **VETERINARY**| Animal Husbandry & P&I (ಪಶು ಸಂಗೋಪನೆ ಮತ್ತು ವಿಸ್ತರಣೆ) |
| **ADMIN** | Administration & HR (ಆಡಳಿತ ಮತ್ತು ಮಾನವ ಸಂಪನ್ಮೂಲ) |
| **IT** | Information Technology (ಮಾಹಿತಿ ತಂತ್ರಜ್ಞಾನ) |

---

## 👥 Office Roles & Workflow

```
┌─────────────────────────┐        ┌─────────────────────────┐        ┌─────────────────────────┐
│   Section Assistant     │ -----> │   Department Manager    │ -----> │    Managing Director    │
│    (Clerk / Staff)      │        │     (Section Head)      │        │        (MD / GM)        │
└────────────┬────────────┘        └────────────┬────────────┘        └────────────┬────────────┘
             │                                  │                                  │
  • Creates file & subject           • Reviews noting & bill            • Final executive approval
  • Attaches PDF bills / letters     • Recommends / adds remarks        • Signs off / returns with remarks
  • Writes green-sheet notings       • Signs off to forward to MD       • Generates signed PDF dossier
```

### Role Terminology
- **Managing Director (MD) / GM:** Final approval authority on files, tender sanctions, and departmental proposals.
- **Department Manager / Section Head:** Reviews and endorses files submitted by section staff.
- **Section Assistant / Clerk:** Creates files, writes initial notes, and uploads bills/letters.
- **System Administrator:** Adds new employee accounts and sets departments.

---

## 📄 In-App Document Previewer
When staff attach PDF quotation bills, scanned society letters, or images:
- Any officer can click on the document chip on the file screen.
- A clean viewer opens directly on the screen with **Zoom In**, **Zoom Out**, and **Rotate** tools.
- There is no need to download attachments to the computer to read them.

---

## 🛡️ Security & Zero Cost
- **No Monthly Cloud Bills:** Runs 100% locally on your KMF Kolar office LAN network.
- **Privacy:** Confidential dairy files and internal notings never leave the office network.
- **Offline Capable:** Continues to work inside the office even if the external internet connection drops.
