import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { ingestDocument } from '../services/jdihIngestion.js';
import { pool } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dokumen simulasi Peraturan Perusahaan JDIH
const sampleRegulationContent = `
PERATURAN PERUSAHAAN PT MAJU BERSAMA TEKNOLOGI
NOMOR: 04/PP/HR-LEGAL/2024
TENTANG: KETENTUAN HARI KERJA, WAKTU KERJA, CUTI, DAN TATA TERTIB DISIPLIN

BAB I: KETENTUAN WAKTU KERJA

Pasal 1: Jam Kerja Reguler
1. Waktu kerja operasional kantor adalah 8 (delapan) jam sehari dan 40 (empat puluh) jam seminggu, tidak termasuk waktu istirahat.
2. Hari kerja formal adalah Senin sampai dengan Jumat, mulai pukul 08.30 WIB sampai dengan pukul 17.30 WIB.
3. Waktu istirahat diberikan selama 1 (satu) jam setiap hari kerja pada pukul 12.00 - 13.00 WIB.

Pasal 2: Keterlambatan dan Presensi
1. Karyawan wajib melakukan pencatatan kehadiran (clock-in) maksimal pada pukul 08.30 WIB melalui aplikasi kehadiran internal.
2. Keterlambatan melebihi 15 (lima belas) menit tanpa persetujuan tertulis dari atasan langsung sebanyak 3 (tiga) kali dalam 1 (satu) bulan akan dikenakan sanksi Surat Peringatan Pertama (SP 1).
3. Akumulasi keterlambatan akan diperhitungkan dalam penilaian kinerja tahunan (KPI).

BAB II: HAK CUTI KARYAWAN

Pasal 3: Cuti Tahunan
1. Karyawan yang telah bekerja terus-menerus selama 12 (dua belas) bulan berhak atas cuti tahunan sebanyak 12 (dua belas) hari kerja.
2. Pengajuan cuti tahunan wajib dilakukan minimal 3 (tiga) hari kerja sebelumnya melalui portal internal HRIS.
3. Hak cuti tahunan yang tidak diambil akan hangus pada akhir tahun berjalan, kecuali ada persetujuan khusus dari Direksi.

Pasal 4: Cuti Sakit dan Cuti Khusus
1. Karyawan yang tidak masuk kerja karena sakit wajib melampirkan surat keterangan dokter resmi dalam waktu 1x24 jam sejak kembali bekerja.
2. Cuti menikah sendiri diberikan selama 3 (tiga) hari kerja dengan tetap mendapatkan upah penuh.
3. Cuti melahirkan bagi karyawati diberikan selama 3 (tiga) bulan sesuai ketentuan perundang-undangan.

BAB III: DISIPLIN DAN SANKSI

Pasal 5: Kerahasiaan Data dan Integritas
1. Setiap karyawan dilarang membocorkan data perusahaan, data pelanggan, atau source code aplikasi internal ke pihak ketiga.
2. Pelanggaran terhadap kerahasiaan data dikategorikan sebagai pelanggaran berat dengan sanksi Pemutusan Hubungan Kerja (PHK) tanpa pesangon serta tuntutan hukum.
`;

async function run() {
  try {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, 'peraturan_perusahaan_sample.txt');
    fs.writeFileSync(filePath, sampleRegulationContent.trim(), 'utf-8');

    console.log(`📁 Sample regulation document created at: ${filePath}`);

    await ingestDocument({
      filePath,
      title: 'Peraturan Disiplin dan Cuti Karyawan 2024',
      documentNumber: '04/PP/HR-LEGAL/2024',
      category: 'Peraturan Perusahaan',
    });

    console.log('✅ Ingest sample completed successfully!');
  } catch (error) {
    console.error('❌ Ingest sample failed:', error);
  } finally {
    await pool.end();
  }
}

run();
