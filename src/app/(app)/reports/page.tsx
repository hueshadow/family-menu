import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportRow } from "@/components/report-row";
import { listReportFilesAction } from "@/app/actions";
import { getLatestDietaryProfiles, getMembers } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [files, members, profiles] = await Promise.all([
    listReportFilesAction(),
    getMembers(),
    getLatestDietaryProfiles(),
  ]);
  const profileByMember = new Map(profiles.map((p) => [p.member_id, p]));
  const dir = process.env.HEALTH_REPORTS_DIR ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold">体检报告</h3>
        <p className="text-sm text-muted-foreground">
          AI 自动识别数字 PDF / 扫描件 → 提取饮食相关指标 → 生成饮食处方。
          <br />
          源目录：<code className="text-xs">{dir || "（未设置 HEALTH_REPORTS_DIR）"}</code>
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h4 className="text-lg font-semibold">扫描到的文件</h4>
          <span className="text-xs text-muted-foreground">
            {files.length} 份 PDF
          </span>
        </div>
        {files.length === 0 ? (
          <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            未在源目录找到 PDF。把文件放入 {dir} 后刷新本页。
          </p>
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <ReportRow key={f.filename} file={f} members={members} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h4 className="text-lg font-semibold">饮食处方（按成员）</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => {
            const p = profileByMember.get(m.id);
            return (
              <Card key={m.id}>
                <CardHeader className="flex-row items-baseline justify-between">
                  <CardTitle className="text-base">{m.name}</CardTitle>
                  {p ? (
                    <span className="text-xs text-muted-foreground">
                      v{p.version} · {p.generated_at.slice(0, 10)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">待生成</span>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {!p ? (
                    <p className="text-muted-foreground">
                      处理 {m.name} 的体检报告后，AI 会在此输出饮食处方。
                    </p>
                  ) : (
                    <>
                      {p.tags.length ? (
                        <div className="flex flex-wrap gap-1">
                          {p.tags.map((t) => (
                            <Badge key={t} variant="secondary">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      {p.recommend.length ? (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            推荐
                          </p>
                          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                            {p.recommend.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {p.avoid.length ? (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            忌口 / 慎用
                          </p>
                          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                            {p.avoid.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {p.rationale ? (
                        <p className="text-xs text-muted-foreground">
                          💡 {p.rationale}
                        </p>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
