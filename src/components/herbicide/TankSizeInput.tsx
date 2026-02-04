import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

interface TankSizeInputProps {
  value: number;
  onChange: (value: number) => void;
}

export function TankSizeInput({ value, onChange }: TankSizeInputProps) {
  const { t } = useLanguage();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t("herbicide.tankSize")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Label htmlFor="tank-size" className="whitespace-nowrap">
            {t("herbicide.tankCapacity")}
          </Label>
          <Input
            id="tank-size"
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value) || 800)}
            className="w-32"
            min={100}
            step={50}
          />
          <span className="text-muted-foreground">{t("herbicide.liters")}</span>
        </div>
      </CardContent>
    </Card>
  );
}
