import { asc, eq, sql } from "drizzle-orm";
import type { db } from "../../db/index.js";
import { appUser, userSocialLink } from "../../db/schema/index.js";
import type { NetworkingCard, PublicNetworkingCard, SocialLink } from "./networking.types.js";

export class NetworkingRepository {
  constructor(readonly database: typeof db) {}

  async findByUserId(userId: number): Promise<NetworkingCard | null> {
    // Una sola sentencia garantiza que opt-in y enlace provengan del mismo
    // snapshot aunque un PUT concurrente esté reemplazando el carnet.
    const rows = await this.database
      .select({
        ownerId: appUser.id,
        optIn: appUser.networkingOptIn,
        platform: userSocialLink.platform,
        url: userSocialLink.url,
        label: userSocialLink.label,
      })
      .from(appUser)
      .leftJoin(userSocialLink, eq(userSocialLink.userId, appUser.id))
      .where(eq(appUser.id, userId))
      .orderBy(asc(userSocialLink.id));

    const owner = rows[0];
    if (!owner) return null;

    return {
      optIn: Boolean(owner.optIn),
      links: rows.flatMap((row) =>
        row.platform == null || row.url == null
          ? []
          : [{ platform: row.platform, url: row.url, label: row.label }],
      ),
    };
  }

  async replaceByUserId(
    userId: number,
    optIn: boolean,
    link: SocialLink | null,
  ): Promise<NetworkingCard | null> {
    return this.database.transaction(async (tx) => {
      // El lock explícito serializa dos PUT concurrentes del mismo propietario
      // antes del delete+insert y preserva el máximo de una fila total.
      const locked = await tx.execute(sql`
        select id
        from app_user
        where id = ${userId}
        for update
      `) as unknown as Array<{ id: number }>;

      if (locked.length === 0) return null;

      await tx
        .update(appUser)
        .set({ networkingOptIn: optIn })
        .where(eq(appUser.id, userId));

      await tx.delete(userSocialLink).where(eq(userSocialLink.userId, userId));

      if (link) {
        await tx.insert(userSocialLink).values({
          userId,
          platform: link.platform,
          url: link.url,
          label: link.label ?? null,
        });
      }

      return {
        optIn,
        links: link ? [link] : [],
      };
    });
  }

  async findPublicByUserId(userId: number): Promise<PublicNetworkingCard | null> {
    const rows = await this.database.execute(sql`
      select
        au.id as user_id,
        au.code,
        au.full_name,
        au.networking_opt_in,
        c.name as career_name,
        t.id as teacher_id,
        case
          when t.id is null then 'Alumno'
          when exists (select 1 from section sec where sec.jp_id = t.id) then 'Jefe de Practica'
          else 'Docente'
        end as role_label,
        usl.platform,
        usl.url,
        usl.label
      from app_user au
      left join student st on st.user_id = au.id
      left join career c on c.id = st.career_id
      left join teacher t on t.user_id = au.id
      left join user_social_link usl on usl.user_id = au.id
      where au.id = ${userId}
      order by usl.id
    `) as unknown as Array<{
      user_id: number;
      code: string;
      full_name: string;
      networking_opt_in: boolean;
      career_name: string | null;
      teacher_id: number | null;
      role_label: string;
      platform: SocialLink["platform"] | null;
      url: string | null;
      label: string | null;
    }>;

    const owner = rows[0];
    if (!owner) return null;

    return {
      optIn: Boolean(owner.networking_opt_in),
      links: rows.flatMap((row) =>
        row.platform == null || row.url == null
          ? []
          : [{ platform: row.platform, url: row.url, label: row.label }],
      ),
      owner: {
        userId: Number(owner.user_id),
        fullName: owner.full_name,
        primaryDetail: owner.career_name ?? "",
        secondaryDetail: `${owner.code} - ${owner.role_label}`,
        roleLabel: owner.role_label,
      },
    };
  }
}
