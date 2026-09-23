import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const outputDir = path.resolve('data');
const outputFile = path.join(outputDir, 'peraturan_perusahaan_sample.pdf');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 50, left: 60, right: 60 },
});

const writeStream = fs.createWriteStream(outputFile);
doc.pipe(writeStream);

// --- HEADER DOKUMEN ---
doc
  .fontSize(14)
  .font('Helvetica-Bold')
  .text('PT MAJU BERSAMA TEKNOLOGI', { align: 'center' })
  .moveDown(0.2);

doc
  .fontSize(10)
  .font('Helvetica')
  .text('Gedung Cyber 2 Lantai 18, Jl. HR Rasuna Said, Jakarta Selatan 12950', { align: 'center' })
  .moveDown(0.5);

doc
  .strokeColor('#333333')
  .lineWidth(1.5)
  .moveTo(60, doc.y)
  .lineTo(535, doc.y)
  .stroke()
  .moveDown(1.2);

// --- JUDUL REGULASI ---
doc
  .fontSize(13)
  .font('Helvetica-Bold')
  .text('PERATURAN PERUSAHAAN', { align: 'center' })
  .fontSize(11)
  .text('NOMOR: 04/PP/HR-LEGAL/2026', { align: 'center' })
  .moveDown(0.3);

doc
  .fontSize(10)
  .font('Helvetica-Bold')
  .text('TENTANG', { align: 'center' })
  .text('KETENTUAN HARI KERJA, WAKTU KERJA, CUTI, DAN TATA TERTIB DISIPLIN', { align: 'center' })
  .moveDown(1.5);

// --- BAB I ---
doc
  .fontSize(11)
  .font('Helvetica-Bold')
  .text('BAB I: KETENTUAN WAKTU KERJA & KEHADIRAN', { underline: true })
  .moveDown(0.5);

doc
  .fontSize(10)
  .font('Helvetica-Bold')
  .text('Pasal 1: Jam Kerja Reguler')
  .font('Helvetica')
  .text('1. Waktu kerja operasional kantor adalah 8 (delapan) jam sehari dan 40 (empat puluh) jam seminggu, tidak termasuk waktu istirahat.')
  .text('2. Hari kerja formal adalah Senin sampai dengan Jumat, mulai pukul 08.30 WIB sampai dengan pukul 17.30 WIB.')
  .text('3. Waktu istirahat diberikan selama 1 (satu) jam setiap hari kerja pada pukul 12.00 - 13.00 WIB.')
  .moveDown(0.8);

doc
  .font('Helvetica-Bold')
  .text('Pasal 2: Keterlambatan dan Presensi')
  .font('Helvetica')
  .text('1. Karyawan wajib melakukan pencatatan kehadiran (clock-in) maksimal pada pukul 08.30 WIB melalui aplikasi presensi internal.')
  .text('2. Keterlambatan melebihi 15 (lima belas) menit tanpa persetujuan tertulis dari atasan langsung sebanyak 3 (tiga) kali dalam 1 (satu) bulan akan dikenakan Surat Peringatan Pertama (SP 1).')
  .text('3. Akumulasi keterlambatan akan diperhitungkan langsung dalam penilaian kinerja tahunan (KPI).')
  .moveDown(1.2);

// --- BAB II ---
doc
  .fontSize(11)
  .font('Helvetica-Bold')
  .text('BAB II: HAK CUTI KARYAWAN', { underline: true })
  .moveDown(0.5);

doc
  .fontSize(10)
  .font('Helvetica-Bold')
  .text('Pasal 3: Cuti Tahunan')
  .font('Helvetica')
  .text('1. Karyawan yang telah bekerja terus-menerus selama 12 (dua belas) bulan berhak atas cuti tahunan sebanyak 12 (dua belas) hari kerja.')
  .text('2. Pengajuan cuti tahunan wajib dilakukan minimal 3 (tiga) hari kerja sebelumnya melalui portal HRIS.')
  .text('3. Hak cuti tahunan yang tidak diambil akan hangus pada akhir tahun berjalan, kecuali terdapat persetujuan tertulis dari Direksi.')
  .moveDown(0.8);

doc
  .font('Helvetica-Bold')
  .text('Pasal 4: Cuti Sakit dan Cuti Khusus')
  .font('Helvetica')
  .text('1. Karyawan yang tidak masuk kerja karena sakit wajib melampirkan surat keterangan dokter resmi dalam waktu 1x24 jam sejak kembali bekerja.')
  .text('2. Cuti menikah sendiri diberikan selama 3 (tiga) hari kerja dengan tetap mendapatkan upah penuh.')
  .text('3. Cuti melahirkan bagi karyawati diberikan selama 3 (tiga) bulan sesuai dengan peraturan perundang-undangan ketenagakerjaan.')
  .moveDown(1.2);

// --- BAB III ---
doc
  .fontSize(11)
  .font('Helvetica-Bold')
  .text('BAB III: KERAHASIAAN INFORMASI & INTEGRITAS', { underline: true })
  .moveDown(0.5);

doc
  .fontSize(10)
  .font('Helvetica-Bold')
  .text('Pasal 5: Kerahasiaan Data Perusahaan')
  .font('Helvetica')
  .text('1. Setiap karyawan dilarang keras membocorkan data perusahaan, data pelanggan, atau source code aplikasi internal kepada pihak ketiga tanpa izin tertulis.')
  .text('2. Pelanggaran terhadap kerahasiaan data dikategorikan sebagai pelanggaran berat dengan sanksi Pemutusan Hubungan Kerja (PHK) tanpa pesangon serta tuntutan pidana/perdata.')
  .moveDown(1.5);

// --- PENUTUP & PENGESAHAN ---
doc
  .fontSize(10)
  .font('Helvetica')
  .text('Ditetapkan di: Jakarta', { align: 'right' })
  .text('Pada tanggal: 10 Januari 2026', { align: 'right' })
  .moveDown(0.5)
  .font('Helvetica-Bold')
  .text('Direksi PT Maju Bersama Teknologi', { align: 'right' })
  .moveDown(2)
  .text('( Budi Santoso, S.Kom., M.M. )', { align: 'right' })
  .font('Helvetica')
  .text('Direktur Utama', { align: 'right' });

doc.end();

writeStream.on('finish', () => {
  const stats = fs.statSync(outputFile);
  console.log(`✅ Sample PDF generated successfully: ${outputFile} (${stats.size} bytes)`);
});
