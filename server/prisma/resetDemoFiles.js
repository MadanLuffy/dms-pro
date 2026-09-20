import '../src/loadEnv.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[resetDemoFiles] Cleaning all existing file records...');
  await prisma.attachment.deleteMany();
  await prisma.note.deleteMany();
  await prisma.approvalMatrix.deleteMany();
  await prisma.subjectFileDept.deleteMany();
  await prisma.subjectFile.deleteMany();

  console.log('[resetDemoFiles] Looking up demo users...');
  const users = await prisma.user.findMany();
  const userByEmail = new Map(users.map((u) => [u.email, u]));

  const ravi = userByEmail.get('ravi.kumar@skandasoft.com');
  const sunil = userByEmail.get('sunil.verma@skandasoft.com');
  const priya = userByEmail.get('priya.sharma@skandasoft.com');
  const neha = userByEmail.get('neha.gupta@skandasoft.com');
  const anita = userByEmail.get('anita.desai@skandasoft.com');
  const rajesh = userByEmail.get('rajesh.mehta@skandasoft.com');
  const ceo = userByEmail.get('ceo@skandasoft.com');

  if (!ravi || !sunil || !priya || !neha || !ceo) {
    throw new Error('Required demo users not found in database. Please run npm run db:seed first.');
  }

  console.log('[resetDemoFiles] Creating showcase demo files including Milk and Paneer...');
  const now = new Date();

  // =========================================================================
  // FILE 1: FRESH MILK BULK PROCUREMENT & COLD-CHAIN LOGISTICS 2026
  // Status: DEPT_HEAD_REVIEW (Demo Milk file with 6 notes & Head replies)
  // =========================================================================
  const milkFile = await prisma.subjectFile.create({
    data: {
      refNo: 'DMS-MK2026',
      subject: 'FRESH MILK BULK PROCUREMENT, FAT/SNF TESTING & COLD-CHAIN LOGISTICS',
      priority: 'HIGH',
      secrecy: 'INTERNAL',
      status: 'DEPT_HEAD_REVIEW',
      creatorId: ravi.id,
      assignedOfficerId: sunil.id,
      targetDepts: {
        create: [{ deptId: 'OPERATIONS' }, { deptId: 'IT' }],
      },
      approvalMatrix: {
        create: [
          {
            deptId: 'OPERATIONS',
            gate: 'DEPT',
            status: 'PENDING',
            comments: 'Under review by Department Head',
          },
          {
            deptId: 'OPERATIONS',
            gate: 'CEO',
            status: 'PENDING',
          },
        ],
      },
    },
  });

  // Note 1: Quality Baseline
  const milkN1 = await prisma.note.create({
    data: {
      fileId: milkFile.id,
      authorId: ravi.id,
      version: 1,
      order: 1,
      content: 'Title: Daily Raw Milk Intake Standards & MBRT Assay Protocol\n\nStandard Operating Procedure for daily procurement of 25,000 liters raw milk. Minimum thresholds enforced: Fat >= 4.5% (Cow) / 6.5% (Buffalo), SNF >= 8.5%, MBRT >= 4.5 hours. Zero tolerance for antibiotic residues, neutralizers, or synthetic adulterants. Lab standard document attached.',
      sentTo: `${sunil.name} (DEPT HEAD)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 25000000),
    },
  });
  await prisma.attachment.create({
    data: {
      fileId: milkFile.id,
      noteId: milkN1.id,
      filename: 'Milk_Testing_Protocol_2026.pdf',
      fileUrl: '/uploads/1788549712100-7d8f83c55d6a4548.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 82104,
    },
  });
  // Head Reply 1
  await prisma.note.create({
    data: {
      fileId: milkFile.id,
      authorId: sunil.id,
      parentId: milkN1.id,
      version: 2,
      order: 2,
      content: 'Quality criteria endorsed. Mandate that automated Gerber centrifuges are calibrated every morning before milk collection begins at village collection centers.',
      sentTo: `${ravi.name} (STAFF)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 24000000),
    },
  });

  // Note 2: Chilling & Telemetry
  const milkN2 = await prisma.note.create({
    data: {
      fileId: milkFile.id,
      authorId: ravi.id,
      version: 3,
      order: 3,
      content: 'Title: Bulk Milk Cooler (BMC) Chilling & IoT Temperature Telemetry\n\n12 Bulk Milk Coolers (BMCs) operational across 4 rural cluster hubs. Rapid chilling to 3.8°C achieved within 90 minutes of milking to inhibit microbial growth. Real-time IoT temperature telemetry stream integrated.',
      sentTo: `${sunil.name} (DEPT HEAD)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 20000000),
    },
  });
  await prisma.attachment.create({
    data: {
      fileId: milkFile.id,
      noteId: milkN2.id,
      filename: 'Milk_BMC_Temperature_Logs.csv',
      fileUrl: '/uploads/1788544663399-b57fe7809d16e6c3.csv',
      mimeType: 'text/csv',
      sizeBytes: 55,
    },
  });
  // Head Reply 2
  await prisma.note.create({
    data: {
      fileId: milkFile.id,
      authorId: sunil.id,
      parentId: milkN2.id,
      version: 4,
      order: 4,
      content: 'Telemetry verified. Configure automatic SMS and app push alerts if any BMC chamber temperature exceeds 4.5°C for longer than 15 minutes.',
      sentTo: `${ravi.name} (STAFF)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 19000000),
    },
  });

  // Note 3: Cooperative Payout
  const milkN3 = await prisma.note.create({
    data: {
      fileId: milkFile.id,
      authorId: ravi.id,
      version: 5,
      order: 5,
      content: 'Title: Dairy Cooperative Payout Rates & Quality Incentive Slabs\n\nProposed farmer payment schedule linked directly to Fat/SNF performance slabs. Farmers maintaining SNF > 9.0% will receive standard ₹3.50/L quality incentive bonus. Fortnightly direct bank transfer schedule finalized.',
      sentTo: `${sunil.name} (DEPT HEAD)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 15000000),
    },
  });
  // Head Reply 3
  await prisma.note.create({
    data: {
      fileId: milkFile.id,
      authorId: sunil.id,
      parentId: milkN3.id,
      version: 6,
      order: 6,
      content: 'Payment matrix approved. Forward payout schedule to Accounts for biometric verification and digital fund disbursement.',
      sentTo: `${ravi.name} (STAFF)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 14000000),
    },
  });

  // Note 4: Insulated Tankers
  const milkN4 = await prisma.note.create({
    data: {
      fileId: milkFile.id,
      authorId: ravi.id,
      version: 7,
      order: 7,
      content: 'Title: Insulated Tanker Logistics & Transit Hygiene Certification\n\nFleet of 6 food-grade insulated stainless steel (SS304) road tankers assigned. Maximum transit time capped at 3 hours between rural collection centers and central processing plant. CIP (Clean-In-Place) sanitation completed daily.',
      sentTo: `${sunil.name} (DEPT HEAD)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 10000000),
    },
  });
  // Head Reply 4
  await prisma.note.create({
    data: {
      fileId: milkFile.id,
      authorId: sunil.id,
      parentId: milkN4.id,
      version: 8,
      order: 8,
      content: 'Logistics protocol cleared. Ensure tanker drivers log digital timestamps at both departure and arrival security gates.',
      sentTo: `${ravi.name} (STAFF)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 9000000),
    },
  });

  // Note 5: Central Pasteurization
  const milkN5 = await prisma.note.create({
    data: {
      fileId: milkFile.id,
      authorId: ravi.id,
      version: 9,
      order: 9,
      content: 'Title: Central Pasteurization & HTST Temperature Validation\n\nHigh-Temperature Short-Time (HTST) pasteurizer cleared sanitization cycle (72°C for 15 seconds followed by rapid regeneration chilling to 4°C). Phosphatase test negative; microbial count < 10,000 CFU/mL.',
      sentTo: `${sunil.name} (DEPT HEAD)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 5000000),
    },
  });
  // Head Reply 5
  await prisma.note.create({
    data: {
      fileId: milkFile.id,
      authorId: sunil.id,
      parentId: milkN5.id,
      version: 10,
      order: 10,
      content: 'Pasteurization batch validated. Operations authorized for 24/7 continuous intake and packaging line transfer.',
      sentTo: `${ravi.name} (STAFF)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 4000000),
    },
  });

  // Note 6: Emergency Backup (Unseen by Head for live deletion demo!)
  await prisma.note.create({
    data: {
      fileId: milkFile.id,
      authorId: ravi.id,
      version: 11,
      order: 11,
      content: 'Title: Cold-Room Power Backup & Spoilage Contingency Protocol\n\nEmergency standby diesel generator deployment for rural chilling hubs #3 and #7 to guarantee uninterrupted chilling during grid outages. (Notice: Unseen by Head — staff can delete this note before the Department Head views it).',
      sentTo: `${sunil.name} (DEPT HEAD)`,
      seenByHead: false,
      seenAt: null,
    },
  });

  // =========================================================================
  // FILE 2: STANDARDIZED PANEER MANUFACTURING & QUALITY ASSURANCE 2026
  // Status: CEO_REVIEW (Demo Paneer file with 6 notes & Head replies)
  // =========================================================================
  const paneerFile = await prisma.subjectFile.create({
    data: {
      refNo: 'DMS-PN2026',
      subject: 'STANDARDIZED PANEER MANUFACTURING, MOISTURE ANALYSIS & VACUUM PACKAGING',
      priority: 'URGENT',
      secrecy: 'CONFIDENTIAL',
      status: 'CEO_REVIEW',
      creatorId: ravi.id,
      assignedOfficerId: sunil.id,
      targetDepts: {
        create: [{ deptId: 'OPERATIONS' }, { deptId: 'FINANCE' }],
      },
      approvalMatrix: {
        create: [
          {
            deptId: 'OPERATIONS',
            gate: 'DEPT',
            status: 'APPROVED',
            reviewedBy: sunil.id,
            comments: 'Approved paneer production specifications and moisture benchmarks',
            timestamp: new Date(now.getTime() - 12000000),
          },
          {
            deptId: 'OPERATIONS',
            gate: 'CEO',
            status: 'PENDING',
          },
        ],
      },
    },
  });

  // Note 1: Coagulation & Citric Acid
  const pnrN1 = await prisma.note.create({
    data: {
      fileId: paneerFile.id,
      authorId: ravi.id,
      version: 1,
      order: 1,
      content: 'Title: Standardization & Citric Acid Coagulation Temperature Optimization\n\nRaw milk standardized to 5.8% fat and 8.8% SNF for optimal curd yield. Heating to 85°C followed by controlled 1.5% citric acid solution coagulation at 82°C for superior protein matrix bonding and soft velvety texture. Batch yield report attached.',
      sentTo: `${sunil.name} (DEPT HEAD)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 30000000),
    },
  });
  await prisma.attachment.create({
    data: {
      fileId: paneerFile.id,
      noteId: pnrN1.id,
      filename: 'Paneer_Batch_Yield_Analysis.csv',
      fileUrl: '/uploads/1788544663399-b57fe7809d16e6c3.csv',
      mimeType: 'text/csv',
      sizeBytes: 55,
    },
  });
  // Head Reply 1
  await prisma.note.create({
    data: {
      fileId: paneerFile.id,
      authorId: sunil.id,
      parentId: pnrN1.id,
      version: 2,
      order: 2,
      content: 'Coagulation temperature standard approved at 82°C. Maintain mechanical pressing pressure at 2.5 kg/cm² for exactly 20 minutes to preserve internal moisture without crumbly edges.',
      sentTo: `${ravi.name} (STAFF)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 29000000),
    },
  });

  // Note 2: Moisture & FSSAI
  const pnrN2 = await prisma.note.create({
    data: {
      fileId: paneerFile.id,
      authorId: ravi.id,
      version: 3,
      order: 3,
      content: 'Title: Moisture Content & FSSAI Total Solids Compliance\n\nLaboratory assay on pilot batch: Moisture content verified at 56.2% (FSSAI statutory ceiling < 60%), Fat on Dry Basis (FDB) at 53.1% (statutory minimum > 50%). Elasticity index and shear firmness score within premium export range. Official compliance certificate attached.',
      sentTo: `${sunil.name} (DEPT HEAD)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 25000000),
    },
  });
  await prisma.attachment.create({
    data: {
      fileId: paneerFile.id,
      noteId: pnrN2.id,
      filename: 'Paneer_FSSAI_Compliance_Certificate.pdf',
      fileUrl: '/uploads/1788549712100-7d8f83c55d6a4548.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 82104,
    },
  });
  // Head Reply 2
  await prisma.note.create({
    data: {
      fileId: paneerFile.id,
      authorId: sunil.id,
      parentId: pnrN2.id,
      version: 4,
      order: 4,
      content: 'Lab compliance certificate verified. Moisture levels meet national food safety guidelines. Authorized to commence cutting line setup for 200g, 500g, and 1kg consumer blocks.',
      sentTo: `${ravi.name} (STAFF)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 24000000),
    },
  });

  // Note 3: Chilled Water Immersion
  const pnrN3 = await prisma.note.create({
    data: {
      fileId: paneerFile.id,
      authorId: ravi.id,
      version: 5,
      order: 5,
      content: 'Title: Chilled Water Immersion & Texture Hardening Protocol\n\nPressed paneer blocks dipped in chilled pasteurized water bath (4°C) for 2 hours for texture stabilization. Surface sanitized on UV-treated drainage conveyor prior to vacuum loading.',
      sentTo: `${sunil.name} (DEPT HEAD)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 20000000),
    },
  });
  // Head Reply 3
  await prisma.note.create({
    data: {
      fileId: paneerFile.id,
      authorId: sunil.id,
      parentId: pnrN3.id,
      version: 6,
      order: 6,
      content: 'Chilled immersion protocol approved. Ensure water in cooling bath is tested for chlorine residual twice per shift.',
      sentTo: `${ravi.name} (STAFF)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 19000000),
    },
  });

  // Note 4: Vacuum Packaging
  const pnrN4 = await prisma.note.create({
    data: {
      fileId: paneerFile.id,
      authorId: ravi.id,
      version: 7,
      order: 7,
      content: 'Title: High-Barrier EVOH Vacuum Packaging & Seal Hermeticity\n\nPackaging line configured with multi-layer co-extruded EVOH high-barrier thermoforming pouches. Vacuum level maintained at -0.092 MPa. Zero package leakage observed across 500-unit helium leak inspection.',
      sentTo: `${sunil.name} (DEPT HEAD)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 15000000),
    },
  });
  // Head Reply 4
  await prisma.note.create({
    data: {
      fileId: paneerFile.id,
      authorId: sunil.id,
      parentId: pnrN4.id,
      version: 8,
      order: 8,
      content: 'Barrier packaging approved. Ensure batch laser coding, manufacturing date, and scan-ready dynamic QR code are printed clearly on every pouch.',
      sentTo: `${ravi.name} (STAFF)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 14000000),
    },
  });

  // Note 5: Shelf Life
  const pnrN5 = await prisma.note.create({
    data: {
      fileId: paneerFile.id,
      authorId: ravi.id,
      version: 9,
      order: 9,
      content: 'Title: Accelerated Shelf-Life Validation (30 Days at 4°C)\n\nRefrigerated storage trial results (Day 30): Free Fatty Acids (FFA) < 0.18%, Coliform count zero, total plate count well below safety threshold. Sensory panel evaluation scored 9.4/10 for frying softness and elasticity.',
      sentTo: `${sunil.name} (DEPT HEAD)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 10000000),
    },
  });
  // Head Reply 5
  await prisma.note.create({
    data: {
      fileId: paneerFile.id,
      authorId: sunil.id,
      parentId: pnrN5.id,
      version: 10,
      order: 10,
      content: 'Shelf-life validation cleared with distinction. Department approval signed off; forwarded file to Executive Office for CEO final authorization.',
      sentTo: `${ravi.name} (STAFF)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 9000000),
    },
  });

  // Note 6: Distribution SLA
  const pnrN6 = await prisma.note.create({
    data: {
      fileId: paneerFile.id,
      authorId: ravi.id,
      version: 11,
      order: 11,
      content: 'Title: Cold-Chain Distribution SLA for 150 Regional Supermarkets\n\nLogistics dispatch agreement finalized with refrigerated reefer carriers for daily delivery across 150 regional supermarket distribution hubs. Transit temperature locked strictly between 2°C and 4°C.',
      sentTo: `${sunil.name} (DEPT HEAD)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 5000000),
    },
  });
  // Head Reply 6
  await prisma.note.create({
    data: {
      fileId: paneerFile.id,
      authorId: sunil.id,
      parentId: pnrN6.id,
      version: 12,
      order: 12,
      content: 'Distribution SLA ratified. Warehouse cold storage and distribution channels cleared for full commercial launch.',
      sentTo: `${ravi.name} (STAFF)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 4000000),
    },
  });

  // =========================================================================
  // FILE 3: IT Infrastructure & Cloud Security Policy v2.0
  // =========================================================================
  const file3 = await prisma.subjectFile.create({
    data: {
      refNo: 'DMS-IT9041',
      subject: 'IT INFRASTRUCTURE & CLOUD SECURITY POLICY V2.0',
      priority: 'HIGH',
      secrecy: 'CONFIDENTIAL',
      status: 'DEPT_HEAD_REVIEW',
      creatorId: ravi.id,
      assignedOfficerId: sunil.id,
      targetDepts: {
        create: [{ deptId: 'IT' }, { deptId: 'OPERATIONS' }],
      },
      approvalMatrix: {
        create: [
          {
            deptId: 'IT',
            gate: 'DEPT',
            status: 'PENDING',
            comments: 'Awaiting departmental review',
          },
          {
            deptId: 'IT',
            gate: 'CEO',
            status: 'PENDING',
          },
        ],
      },
    },
  });

  const f3n1 = await prisma.note.create({
    data: {
      fileId: file3.id,
      authorId: ravi.id,
      version: 1,
      order: 1,
      content: 'Title: Security Baseline & Deployment Roadmap\n\nComprehensive infrastructure upgrade proposal including TLS 1.3 enforcement and multi-factor authentication across all engineering nodes. Supporting compliance checklist attached.',
      sentTo: `${sunil.name} (DEPT HEAD)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 3600000),
    },
  });

  await prisma.attachment.create({
    data: {
      fileId: file3.id,
      noteId: f3n1.id,
      filename: 'IT_Security_Framework_2026.pdf',
      fileUrl: '/uploads/1788549712100-7d8f83c55d6a4548.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 82104,
    },
  });

  // =========================================================================
  // FILE 4: FY2026 Enterprise Capital Expenditure & Budget Allocation
  // =========================================================================
  const file4 = await prisma.subjectFile.create({
    data: {
      refNo: 'DMS-FN7283',
      subject: 'FY2026 ENTERPRISE CAPITAL EXPENDITURE & BUDGET ALLOCATION',
      priority: 'URGENT',
      secrecy: 'CONFIDENTIAL',
      status: 'CEO_REVIEW',
      creatorId: priya.id,
      assignedOfficerId: neha.id,
      targetDepts: {
        create: [{ deptId: 'FINANCE' }, { deptId: 'LEGAL' }],
      },
      approvalMatrix: {
        create: [
          {
            deptId: 'FINANCE',
            gate: 'DEPT',
            status: 'APPROVED',
            reviewedBy: neha.id,
            comments: 'Approved - audited against FY2026 corporate capital expenditure cap',
            timestamp: new Date(now.getTime() - 7200000),
          },
          {
            deptId: 'LEGAL',
            gate: 'DEPT',
            status: 'APPROVED',
            reviewedBy: anita ? anita.id : neha.id,
            comments: 'Legal compliance and contract terms cleared',
            timestamp: new Date(now.getTime() - 3600000),
          },
          {
            deptId: 'FINANCE',
            gate: 'CEO',
            status: 'PENDING',
          },
        ],
      },
    },
  });

  const f4n1 = await prisma.note.create({
    data: {
      fileId: file4.id,
      authorId: priya.id,
      version: 1,
      order: 1,
      content: 'Title: Capital Expenditure Proposal & Multi-Department Signoff\n\nAnnual equipment and data center expansion roadmap with quarterly disbursement schedules. Awaiting final executive authorization.',
      sentTo: `${neha.name} (DEPT HEAD)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 8000000),
    },
  });

  await prisma.attachment.create({
    data: {
      fileId: file4.id,
      noteId: f4n1.id,
      filename: 'Capex_Budget_Allocation_2026.csv',
      fileUrl: '/uploads/1788544663399-b57fe7809d16e6c3.csv',
      mimeType: 'text/csv',
      sizeBytes: 55,
    },
  });

  await prisma.note.create({
    data: {
      fileId: file4.id,
      authorId: neha.id,
      parentId: f4n1.id,
      version: 2,
      order: 2,
      content: 'Verified compliance with corporate tax and audit guidelines. Department signoff completed; forwarded to CEO for executive approval.',
      sentTo: `${priya.name} (STAFF)`,
      seenByHead: true,
      seenAt: new Date(now.getTime() - 7000000),
    },
  });

  // =========================================================================
  // FILE 5: Logistics & Operations Master Services Agreement
  // =========================================================================
  const file5 = await prisma.subjectFile.create({
    data: {
      refNo: 'DMS-OP4190',
      subject: 'LOGISTICS & OPERATIONS MASTER SERVICES AGREEMENT',
      priority: 'NORMAL',
      secrecy: 'INTERNAL',
      status: 'APPROVED',
      creatorId: rajesh ? rajesh.id : sunil.id,
      assignedOfficerId: rajesh ? rajesh.id : sunil.id,
      targetDepts: {
        create: [{ deptId: 'OPERATIONS' }],
      },
      approvalMatrix: {
        create: [
          {
            deptId: 'OPERATIONS',
            gate: 'DEPT',
            status: 'APPROVED',
            reviewedBy: rajesh ? rajesh.id : sunil.id,
            comments: 'Approved operational schedules and freight tariff rates',
            timestamp: new Date(now.getTime() - 86400000),
          },
          {
            deptId: 'OPERATIONS',
            gate: 'CEO',
            status: 'APPROVED',
            reviewedBy: ceo.id,
            comments: 'Approved and ratified by Executive Council. Authorized for final deployment.',
            timestamp: new Date(now.getTime() - 43200000),
          },
        ],
      },
    },
  });

  const f5n1 = await prisma.note.create({
    data: {
      fileId: file5.id,
      authorId: rajesh ? rajesh.id : sunil.id,
      version: 1,
      order: 1,
      content: 'Title: Master Logistics Agreement & Carrier Terms\n\nFinalized master services contract covering multi-modal freight transport and quarterly SLA fulfillment. All compliance conditions met.',
      sentTo: 'Executive Council',
      seenByHead: true,
      seenAt: new Date(now.getTime() - 90000000),
    },
  });

  await prisma.attachment.create({
    data: {
      fileId: file5.id,
      noteId: f5n1.id,
      filename: 'Logistics_MSA_Schedule_2026.csv',
      fileUrl: '/uploads/1788544663399-b57fe7809d16e6c3.csv',
      mimeType: 'text/csv',
      sizeBytes: 55,
    },
  });

  console.log('[resetDemoFiles] Done! Created files:');
  console.log('  1. DMS-MK2026 (DEPT_HEAD_REVIEW) - FRESH MILK BULK PROCUREMENT (6 notes + 5 head replies)');
  console.log('  2. DMS-PN2026 (CEO_REVIEW) - STANDARDIZED PANEER MANUFACTURING (6 notes + 6 head replies)');
  console.log('  3. DMS-IT9041 (DEPT_HEAD_REVIEW) - IT Infrastructure & Cloud Security Policy v2.0');
  console.log('  4. DMS-FN7283 (CEO_REVIEW) - FY2026 Enterprise Capital Expenditure & Budget Allocation');
  console.log('  5. DMS-OP4190 (APPROVED) - Logistics & Operations Master Services Agreement');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
