import Link from "next/link";
import { ArrowRight, FileHeart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllReports, getLatestDietaryProfiles, getMembers } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  const [members, profiles, reports] = await Promise.all([
    getMembers(),
    getLatestDietaryProfiles(),
    getAllReports(),
  ]);
  const profileByMember = new Map(profiles.map((p) => [p.member_id, p]));
  const reportCountByMember = reports.reduce<Map<string, number>>((acc, r) => {
    acc.set(r.member_id, (acc.get(r.member_id) ?? 0) + 1);
    return acc;
  }, new Map());

  const totalReports = reports.length;
  const profiledMembers = profiles.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl tracking-wide">家庭档案</h3>
          <p className="text-sm text-muted-foreground">
            5 名成员的健康标签与饮食处方 · 处方由体检报告 AI 自动推导
          </p>
        </div>
      </div>

      <Link
        href="/reports"
        className="group block"
      >
        <Card className="border-border/70 bg-card transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-3 text-primary">
              <FileHeart className="size-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">体检报告</p>
              <p className="text-xs text-muted-foreground">
                {totalReports > 0
                  ? `已解析 ${totalReports} 份报告 · 生成 ${profiledMembers} 份处方`
                  : "还没有解析过任何报告"}
                ，点击进入上传 / 查看
              </p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
          </CardContent>
        </Card>
      </Link>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => {
          const dp = profileByMember.get(m.id);
          const reportCount = reportCountByMember.get(m.id) ?? 0;
          return (
            <Card key={m.id}>
              <CardHeader>
                <CardTitle className="flex items-baseline gap-2">
                  <span>{m.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {m.age} 岁
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {m.profile.healthFlags?.length ? (
                  <Section label="健康状况">
                    {m.profile.healthFlags.map((f) => (
                      <Badge key={f} variant="destructive">
                        {f}
                      </Badge>
                    ))}
                  </Section>
                ) : null}
                {m.profile.intolerances?.length ? (
                  <Section label="不耐受">
                    {m.profile.intolerances.map((f) => (
                      <Badge key={f} variant="outline">
                        {f}
                      </Badge>
                    ))}
                  </Section>
                ) : null}
                {m.profile.goals?.length ? (
                  <Section label="饮食目标">
                    {m.profile.goals.map((f) => (
                      <Badge key={f}>{f}</Badge>
                    ))}
                  </Section>
                ) : null}
                {m.profile.preferences?.length ? (
                  <Section label="偏好">
                    {m.profile.preferences.map((f) => (
                      <Badge key={f} variant="secondary">
                        {f}
                      </Badge>
                    ))}
                  </Section>
                ) : null}
                {dp?.tags.length ? (
                  <Section label={`体检处方 v${dp.version}`}>
                    {dp.tags.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </Section>
                ) : null}
                {m.profile.notes ? (
                  <p className="text-muted-foreground">{m.profile.notes}</p>
                ) : null}
                <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs text-muted-foreground">
                  <span>
                    {reportCount > 0
                      ? `📋 ${reportCount} 份报告`
                      : "暂无体检报告"}
                  </span>
                  <Link
                    href="/reports"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    管理 →
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}
