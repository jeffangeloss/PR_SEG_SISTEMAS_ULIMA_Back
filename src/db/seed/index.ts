import "dotenv/config";
import { db } from "../index";
import { sql } from "drizzle-orm";
import syllabusJson from "../../../../ulima_silabos_links_formulas/ulima_silabos_links_formulas.json";

async function seedSyllabi() {
  const entries = (syllabusJson as any).syllabi as Array<{
    course_code: string;
    drive_file_id: string | null;
    button_url: string | null;
    has_syllabus_link: boolean;
  }>;

  const valid = entries.filter((e) => e.has_syllabus_link && e.drive_file_id && e.button_url);

  console.log(`Seeding ${valid.length} syllabus entries...`);

  let inserted = 0;
  let skipped = 0;

  for (const entry of valid) {
    const rows = await db.execute(sql`
      select co.id as course_offering_id
      from course c
      join course_offering co on co.course_id = c.id
      join academic_period ap on ap.id = co.academic_period_id
      where c.code = ${entry.course_code}
        and ap.is_active = true
      limit 1
    `) as unknown as Array<{ course_offering_id: number }>;

    if (rows.length === 0) {
      console.log(`  SKIP (no offering): ${entry.course_code}`);
      skipped++;
      continue;
    }

    const courseOfferingId = rows[0].course_offering_id;

    await db.execute(sql`
      insert into syllabus (course_offering_id, drive_file_id, drive_file_url)
      values (${courseOfferingId}, ${entry.drive_file_id}, ${entry.button_url})
      on conflict (course_offering_id) do update
        set drive_file_id  = excluded.drive_file_id,
            drive_file_url = excluded.drive_file_url
    `);

    inserted++;
  }

  console.log(`Done. Inserted/updated: ${inserted}, skipped: ${skipped}`);
  process.exit(0);
}

seedSyllabi().catch((err) => {
  console.error(err);
  process.exit(1);
});
