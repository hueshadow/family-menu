import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMembers } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  const members = await getMembers();
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold">家庭档案</h3>
        <p className="text-sm text-muted-foreground">
          M2 只读视图。M3 起会接入体检报告自动更新饮食处方。
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <Card key={m.id}>
            <CardHeader>
              <CardTitle className="flex items-baseline gap-2">
                <span>{m.name}</span>
                <span className="text-sm text-muted-foreground">{m.age} 岁</span>
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
              {m.profile.notes ? (
                <p className="text-muted-foreground">{m.profile.notes}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
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
