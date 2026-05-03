import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MamaHome() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-semibold">本周菜单</h3>
          <p className="text-sm text-muted-foreground">M2 将在此处呈现 6 天 × 4 菜审核网格</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">骨架</Badge>
          <Button disabled>一键生成下周</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {["周一", "周二", "周三", "周四", "周五", "周六"].map((d) => (
          <Card key={d}>
            <CardHeader>
              <CardTitle className="text-base">{d}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>主荤 / 副荤 / 蔬菜 / 汤</p>
              <p className="text-xs">待 AI 生成</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
