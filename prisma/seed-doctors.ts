import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['query', 'info', 'warn', 'error'],
} as any);

// Data dokter dalam format array
const doctorData = [
  { name: 'dr. Era Damaisari, Sp.KFR', specialty: 'Rehabilitasi Medik', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/f4dc748d-a0f9-4ce1-bff8-1d2a0c0187c9.jpg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:27:43.757963+00', updated_at: '2025-11-27 01:18:01.764067+00', slug: 'dr-era-damaisari-spkfr', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Rehabilitasi Medik', bpjs: 'TRUE' },
  { name: 'dr. Dewi Roziqo, Sp.Rad', specialty: 'Radiologi', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/083f336e-f3ce-4d85-9a9f-f9ff9504a390.png', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:34:24.692099+00', updated_at: '2025-11-18 01:44:04.409991+00', slug: 'dr-dewi-roziqo-sprad', kd_dokter: '', is_executive: 'FALSE', sip_number: 'FALSE', specialization: 'Radiologi', bpjs: 'FALSE' },
  { name: 'dr. Salim S. Thalib, Sp.P(K)', specialty: 'Paru-Paru', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/e203cf82-1c28-45a4-a0a8-d7615849ff9a.jpeg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:33:47.075285+00', updated_at: '2025-11-27 01:27:05.636895+00', slug: 'dr-salim-s-thalib-sppk', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Paru-Paru', bpjs: 'TRUE' },
  { name: 'dr. Herpan Syafi\'i Harahap, Sp.N, M.Biomed', specialty: 'Saraf', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/230ec416-1a7c-459b-8454-0cbeaa6216e2.jpeg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-25 05:56:44.761708+00', updated_at: '2025-11-27 01:16:59.220745+00', slug: 'dr-dr-herpan-syafii-harahap-spn-mbiomed', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Saraf', bpjs: 'TRUE' },
  { name: 'dr. Yanna Indrayana, Sp.JP., FIHA., FAsCC', specialty: 'Jantung', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/48171ca9-a496-49cf-ae74-7cb8c8e8af41.jpeg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-27 01:19:43.023903+00', slug: 'dr-dr-yanna-indrayana-spjp-fiha-fascc', kd_dokter: '', is_executive: 'FALSE', sip_number: 'FALSE', specialization: 'Jantung', bpjs: 'FALSE' },
  { name: 'dr. Iga Diah Kumaradewi, M.Biomed, Sp.KJ', specialty: 'Jiwa', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/d9c80fc2-f873-4240-8809-6737e3ecbdd9.jpeg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-25 06:01:47.661+00', updated_at: '2025-11-27 01:21:29.336253+00', slug: 'dr-iga-diah-kumaradewi-mbiomed-spkj', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Jiwa', bpjs: 'TRUE' },
  { name: 'dr. H. Nanang Widodo, Sp.B., M.Sc., MPH., FINACS', specialty: 'Bedah Umum', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/7d3cab66-820a-4d10-8ae6-446e5b22c2f7.jpg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-27 01:22:20.205264+00', slug: 'dr-h-nanang-widodo-spb-msc-mph-finacs', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Bedah Umum', bpjs: 'TRUE' },
  { name: 'dr. Rina Lestari, Sp.P(K)', specialty: 'Paru-Paru', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/4f2f6c5f-f139-45dc-bf4d-be7ff43fbe1c.jpg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-25 06:00:16.146309+00', updated_at: '2025-11-27 01:28:30.618547+00', slug: 'dr-rina-lestari-sppk', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Paru-Paru', bpjs: 'TRUE' },
  { name: 'dr. Gustin Fat\'aah Muhayani, Sp.KFR', specialty: 'Rehabilitasi Medik', image_url: '', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-25 06:03:12.16125+00', updated_at: '2025-11-26 01:00:59.271639+00', slug: 'dr-gustin-fataah-muhayani-spkfr', kd_dokter: '', is_executive: 'FALSE', sip_number: 'TRUE', specialization: 'Rehabilitasi Medik', bpjs: 'TRUE' },
  { name: 'dr. I Wayan Subagiarta, Sp.N', specialty: 'Saraf', image_url: '', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-25 05:57:01.287267+00', slug: 'dr-i-wayan-subagiarta-spn', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Saraf', bpjs: 'TRUE' },
  { name: 'dr. Aria Danurdoro, Sp.U', specialty: 'Urologi', image_url: '', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:27:04.579641+00', updated_at: '2025-11-25 05:54:43.978921+00', slug: 'dr-aria-danurdoro-spu', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Urologi', bpjs: 'TRUE' },
  { name: 'dr. Nusairi, Sp.Rad., Subsp.RI(K)', specialty: 'Radiologi', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/a98e39ad-8c90-433a-b87d-eab16c00a9be.png', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:35:03.318988+00', updated_at: '2025-11-18 01:46:58.138449+00', slug: 'dr-nusairi-sprad-subsprik', kd_dokter: '', is_executive: 'FALSE', sip_number: 'FALSE', specialization: 'Radiologi', bpjs: 'FALSE' },
  { name: 'dr. Bayu Setia, M. Biomed, Sp.JP., FIHA', specialty: 'Jantung', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/c3ca0be5-56d6-4bad-a109-ce03ef7a5b87.jpeg', description: '<p></p>', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-18 01:49:33.741623+00', slug: 'dr-bayu-setia-m-biomed-spjp-fiha', kd_dokter: '', is_executive: 'FALSE', sip_number: 'FALSE', specialization: 'Jantung', bpjs: 'FALSE' },
  { name: 'dr. Made Sujaya, Sp.PD., FINASIM', specialty: 'Penyakit Dalam', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/742e88d8-8926-4e81-9a55-8eb08b24996e.png', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-25 05:58:10.284021+00', slug: 'dr-made-sujaya-sppd-finasim', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Penyakit Dalam', bpjs: 'TRUE' },
  { name: 'dr. Didit Yudhanto, Sp.THT-KL., M.Sc', specialty: 'THT', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/abouts/doctors/1763779512533-4so724mmjim.jpg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:29:12.897385+00', updated_at: '2025-11-25 05:53:50.756825+00', slug: 'dr-didit-yudhanto-sptht-kl-msc', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'THT', bpjs: 'TRUE' },
  { name: 'dr. H. Pebrian Jauhari, Sp.U', specialty: 'Urologi', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/e7fd4e7f-501c-44d5-ba05-52bc16d168f1.png', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:28:47.532883+00', updated_at: '2025-11-18 01:45:14.536744+00', slug: 'dr-h-pebrian-jauhari-spu', kd_dokter: '', is_executive: 'FALSE', sip_number: 'FALSE', specialization: 'Urologi', bpjs: 'FALSE' },
  { name: 'dr. Ario D., Sp.OG., Subsp.KFM', specialty: 'Kandungan', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/44860538-a127-4a17-bccf-c64506377593.png', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:28:07.726463+00', updated_at: '2025-11-25 06:02:13.905424+00', slug: 'dr-ario-d-spog-subspkfm', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Kandungan', bpjs: 'TRUE' },
  { name: 'dr. Wahyu Nur Chalamsah, S.Sp.B (K) Onk, Msi. Med., MH.Kes., CMC', specialty: 'Bedah', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/cf57eecf-0726-4526-9878-d5699358f55e.png', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-25 05:55:32.566355+00', slug: 'drwahyu-nur-chalamsah-sspb-k-onk-msi-med-mhkes-cmc', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Bedah', bpjs: 'TRUE' },
  { name: 'dr. Santyo Wibowo, Sp.B', specialty: 'Bedah', image_url: '', description: '["Spesialis Bedah"]', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-26 03:48:44.297116+00', updated_at: '2025-11-26 03:48:44.297116+00', slug: 'dr-santyo-wibowo-spb', kd_dokter: '', is_executive: 'FALSE', sip_number: 'FALSE', specialization: 'Bedah', bpjs: 'FALSE' },
  { name: 'dr. Dewi Gotama, Sp.DV', specialty: 'Kulit & Kelamin', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/9c5c7421-b57c-4f99-8bdd-4db5fa7453f2.png', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:35:49.599943+00', updated_at: '2025-11-25 06:03:34.210067+00', slug: 'dr-dewi-gotama-spdv', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Kulit & Kelamin', bpjs: 'TRUE' },
  { name: 'dr. M. Farizka Firdaus, Sp.B', specialty: 'Bedah', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/f1093596-b560-4d06-8fdc-c1d57043e3f9.jpeg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-27 01:25:57.647558+00', slug: 'dr-m-farizka-firdaus-spb', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Bedah', bpjs: 'TRUE' },
  { name: 'dr. Ancella Soenardi S., Sp.DV', specialty: 'Kulit & Kelamin', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/7abaf785-ed76-4571-adc8-0da088da010d.jpg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-25 06:04:15.004484+00', updated_at: '2025-11-27 01:12:57.257869+00', slug: 'dr-ancella-soenardi-s-spdv', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Kulit & Kelamin', bpjs: 'TRUE' },
  { name: 'dr. I Gede Suparta, Sp.M', specialty: 'Mata', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/d2dcc1bf-6fef-490a-9f5b-f27451443ad5.jpeg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:30:54.567677+00', updated_at: '2025-11-27 01:16:02.00227+00', slug: 'dr-i-gede-suparta-spm', kd_dokter: '', is_executive: 'FALSE', sip_number: 'FALSE', specialization: 'Mata', bpjs: 'FALSE' },
  { name: 'dr. Ida Ayu Nanda D., Sp.PD', specialty: 'Penyakit Dalam', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/fe549a24-8ffb-4e8c-ae52-0ad7a3901698.jpeg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-25 05:57:58.182181+00', updated_at: '2025-11-27 01:15:01.072698+00', slug: 'dr-ida-ayu-nanda-d-sppd', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Penyakit Dalam', bpjs: 'TRUE' },
  { name: 'dr. Sunanto, Sp.BA., MH.Kes.,CMC', specialty: 'Bedah', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/2a5c121d-be62-46e3-9d80-1ff2e1dd7968.png', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-25 05:53:59.832274+00', slug: 'dr-sunanto-spba-mhkescmc', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Bedah', bpjs: 'TRUE' },
  { name: 'dr. Alisza Novrita Sari., Sp.OG', specialty: 'Kandungan', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/abouts/doctors/1763701582313-koo4uu5oaet.jpg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:28:21.241662+00', updated_at: '2025-11-25 05:45:22.375971+00', slug: 'dr-alisza-novrita-sari-spogalisza', kd_dokter: '', is_executive: 'FALSE', sip_number: 'TRUE', specialization: 'Kandungan', bpjs: 'TRUE' },
  { name: 'drg. Ni Made Ambaryati, M.Kes', specialty: 'Gigi & Mulut', image_url: '', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:29:23.653024+00', updated_at: '2025-11-18 01:48:11.098738+00', slug: 'drg-ni-made-ambaryati-mkes', kd_dokter: '', is_executive: 'FALSE', sip_number: 'FALSE', specialization: 'Gigi & Mulut', bpjs: 'FALSE' },
  { name: 'dr. Putu Anisya Sujaya, Sp.PD', specialty: 'Penyakit dalam', image_url: '', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-25 05:59:28.546126+00', slug: 'dr-putu-anisya-sujaya-sppd', kd_dokter: '', is_executive: 'FALSE', sip_number: 'TRUE', specialization: 'Penyakit dalam', bpjs: 'TRUE' },
  { name: 'dr. Hj. Indri Hapsari., Msc., Sp.A., MH.Kes, CMC', specialty: 'Anak', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/e72d3945-34ce-4619-8de6-3ac613f25337.png', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:31:58.125391+00', updated_at: '2025-11-25 05:54:17.647873+00', slug: 'dr-hj-indri-hapsari-msc-spa-mhkes-cmc', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Anak', bpjs: 'TRUE' },
  { name: 'dr. Kristopher May Pamudji., M.Biomed, Sp.A', specialty: 'Anak', image_url: '', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:31:31.921678+00', updated_at: '2025-11-25 05:54:30.548659+00', slug: 'dr-kristopher-may-pamudji-mbiomed-spa', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Anak', bpjs: 'TRUE' },
  { name: 'dr. Danang Nur A., Sp.KJ., SH', specialty: 'Jiwa', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/e0849647-9705-48d8-a230-6e073731a3db.jpeg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-25 06:01:03.386597+00', updated_at: '2025-11-27 01:18:53.288968+00', slug: 'dr-danang-nur-a-spkj-sh', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Jiwa', bpjs: 'TRUE' },
  { name: 'Dr. H. Ahmad Taufik S., Sp.OT', specialty: 'Orthopedi', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/97504246-922e-45a0-9645-bd13f7a0d3bb.png', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-25 05:46:17.016873+00', slug: 'dr-dr-h-ahmad-taufik-s-spottaufik', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Orthopedi', bpjs: 'TRUE' },
  { name: 'dr. M. Sofyan Faridi, Sp.N', specialty: 'Saraf', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/57ad5e26-84d5-4c23-ace0-a8092c941c37.jpg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-27 01:24:50.083287+00', slug: 'dr-m-sofyan-faridi-spn', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Saraf', bpjs: 'TRUE' },
  { name: 'dr. Faradika Nopta Hadiatma, Sp.PD', specialty: 'Penyakit dalam', image_url: '', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-25 05:59:09.721478+00', slug: 'dr-faradika-nopta-hadiatma-sppd', kd_dokter: '', is_executive: 'FALSE', sip_number: 'FALSE', specialization: 'Penyakit dalam', bpjs: 'FALSE' },
  { name: 'dr. Philip Habib, Sp.PD', specialty: 'Penyakit dalam', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/75161081-3770-401a-81a2-a28e85a71436.jpg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-27 01:25:57.341486+00', slug: 'dr-philip-habib-sppd', kd_dokter: '', is_executive: 'FALSE', sip_number: 'FALSE', specialization: 'Penyakit dalam', bpjs: 'FALSE' },
  { name: 'dr. Catarina Budyono, Sp.PD., K-GEH, FINASIM', specialty: 'Penyakit dalam', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/277c2781-3dcd-451b-926c-f72cddf6990c.png', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-27 01:13:20.852428+00', slug: 'dr-catarina-budyono-sppd-k-geh-finasim', kd_dokter: '', is_executive: 'FALSE', sip_number: 'FALSE', specialization: 'Penyakit dalam', bpjs: 'FALSE' },
  { name: 'dr. H. Arif Zuhan, Sp.B-KBD', specialty: 'Bedah', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/d16cfa14-93aa-43f8-a1ae-889758a7dddd.jpeg', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-25 05:53:32.597029+00', updated_at: '2025-11-27 01:20:31.469968+00', slug: 'dr-h-arif-zuhan-spb-kbd', kd_dokter: '', is_executive: 'TRUE', sip_number: 'TRUE', specialization: 'Bedah', bpjs: 'TRUE' },
  { name: 'drg. Eka Junaidi', specialty: 'Gigi & Mulut', image_url: 'https://rfbsyhpuuptvfeumxnra.supabase.co/storage/v1/object/public/doctors/doctors/4396fe31-8f32-439f-90e6-0b453836c764.png', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:29:41.383292+00', updated_at: '2025-11-18 01:48:02.060558+00', slug: 'drg-eka-junaidi', kd_dokter: '', is_executive: 'FALSE', sip_number: 'FALSE', specialization: 'Gigi & Mulut', bpjs: 'FALSE' },
  { name: 'dr. I Putu Gede Yudi D.W.S, Sp.M', specialty: 'Mata', image_url: '', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-11-14 06:30:23.288568+00', updated_at: '2025-11-18 01:45:45.685312+00', slug: 'dr-i-putu-gede-yudi-dws-spm', kd_dokter: '', is_executive: 'FALSE', sip_number: 'FALSE', specialization: 'Mata', bpjs: 'FALSE' },
  { name: 'dr. Larangga Gempa B., Sp.PD', specialty: 'Penyakit dalam', image_url: '', description: '', experience_years: '0', education: '', certifications: '', consultation_fee: '160000', created_at: '2025-10-26 11:23:25.190363+00', updated_at: '2025-11-18 01:46:25.252554+00', slug: 'dr-larangga-gempa-b-sppd', kd_dokter: '', is_executive: 'FALSE', sip_number: 'FALSE', specialization: 'Penyakit dalam', bpjs: 'FALSE' },
  // ... Anda dapat menambahkan data lainnya di sini ...
].map(item => ({
  ...item,
  // Buat email unik dari nama dan tambahkan domain palsu
  email: `${item.name.toLowerCase().replace(/\s+/g, '.').replace(/[^\w.-]/g, '')}@example.com`,
  // Gunakan sip_number jika tersedia, jika tidak buat default
  licenseNumber: item.sip_number && item.sip_number !== 'TRUE' && item.sip_number !== 'FALSE' ? item.sip_number : `SIP-${item.name.replace(/\s+/g, '-')}`,
  // Gunakan image_url untuk avatar
  imageUrl: item.image_url || null,
  // Gunakan description untuk bio
  bio: item.description || null,
  // Gunakan specialty untuk specialization
  specialization: item.specialty,
  // Nilai default untuk field opsional
  phone: null,
  department: null,
  isActive: true,
  // createdAt dan updatedAt akan diatur oleh Prisma
  consultation_fee: item.consultation_fee ? parseInt(item.consultation_fee) : null,
  is_executive: item.is_executive === 'TRUE',
  bpjs: item.bpjs === 'TRUE',
  sip_number: item.sip_number,
  slug: item.slug,
  kd_dokter: item.kd_dokter,
  specialtyImage_url: null, // Asumsikan null dulu atau mapping jika ada
  experience_years: item.experience_years ? parseInt(item.experience_years) : 0,
  description: item.description,
  education: item.education,
  certifications: item.certifications,
})); // Transformasi data ke format yang sesuai skema Prisma



// Mapping spesialiasi ke slug kategori yang ada
function getCategorySlug(specialty: string): string | null {
  const map: Record<string, string> = {
    'Rehabilitasi Medik': 'rehabilitasi-medik',
    'Radiologi': 'radiologi',
    'Saraf': 'saraf',
    'Jantung': 'jantung',
    'Bedah Umum': 'bedah',
    'Bedah': 'bedah',
    'THT': 'tht',
    'Kandungan': 'kandungan',
    'Kulit & Kelamin': 'kulit-kelamin',
    'Penyakit Dalam': 'penyakit-dalam',
    'Penyakit dalam': 'penyakit-dalam',
    'Anak': 'anak',
    'Orthopedi': 'orthopedi',
    'Mata': 'mata',
    'Gigi & Mulut': 'poli-gigi',
    'Poli Umum': 'poli-umum',
  };
  return map[specialty] || null;
}

async function main() {
  console.log('Memulai seeding data dokter...');

  for (const doctor of doctorData) {
    try {
      const categorySlug = getCategorySlug(doctor.specialization);
      
      const createdDoctor = await prisma.doctor.create({
        data: {
          name: doctor.name,
          email: doctor.email,
          phone: doctor.phone,
          specialization: doctor.specialization,
          department: doctor.department,
          licenseNumber: doctor.licenseNumber,
          imageUrl: doctor.imageUrl,
          bio: doctor.bio,
          isActive: doctor.isActive,
          consultation_fee: doctor.consultation_fee,
          is_executive: doctor.is_executive,
          bpjs: doctor.bpjs,
          sip_number: doctor.sip_number,
          slug: doctor.slug,
          kd_dokter: doctor.kd_dokter,
          specialtyImage_url: doctor.specialtyImage_url,
          experience_years: doctor.experience_years,
          description: doctor.description,
          education: doctor.education,
          certifications: doctor.certifications,
          categories: {
            connect: [
               // Connect berdasarkan mapping spesialisasi
               ...(categorySlug ? [{ slug: categorySlug }] : []),
               // Connect ke Poli Executive jika is_executive true
               ...(doctor.is_executive ? [{ slug: 'poli-executive' }] : []),
            ],
          } 
        },
      });
      console.log(`Dokter berhasil dibuat: ${createdDoctor.name} (${createdDoctor.id})`);
    } catch (error: any) {
      if (error.code === 'P2002') { // Unique constraint violation
        console.warn(`Dokter dengan email atau license number '${doctor.email}' / '${doctor.licenseNumber}' sudah ada, dilewati.`);
      } else {
        console.error(`Error saat membuat dokter ${doctor.name}:`, error);
      }
    }
  }

  console.log('Seeding selesai.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });