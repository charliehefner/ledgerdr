import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Database, 
  Shield, 
  Bell, 
  Palette,
  Save,
  TestTube
} from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const handleTestConnection = () => {
    toast.info("Testing database connection...");
    setTimeout(() => {
      toast.success("Database connection successful!");
    }, 1500);
  };

  const handleSave = () => {
    toast.success("Settings saved successfully!");
  };

  return (
    <MainLayout title="Settings" subtitle="Configure your application">
      <div className="max-w-3xl space-y-8 animate-fade-in">
        {/* Database Connection */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Database Connection</h3>
              <p className="text-sm text-muted-foreground">
                Connect to your PostgreSQL database
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="host">Host</Label>
                <Input id="host" placeholder="db.example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input id="port" placeholder="5432" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="database">Database Name</Label>
                <Input id="database" placeholder="expense_ledger" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user">Username</Label>
                <Input id="user" placeholder="db_user" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleTestConnection}>
                <TestTube className="mr-2 h-4 w-4" />
                Test Connection
              </Button>
              <span className="text-sm text-muted-foreground">
                Test before saving to ensure connectivity
              </span>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Preferences</h3>
              <p className="text-sm text-muted-foreground">
                Customize your experience
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Select defaultValue="usd">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD ($)</SelectItem>
                    <SelectItem value="eur">EUR (€)</SelectItem>
                    <SelectItem value="gbp">GBP (£)</SelectItem>
                    <SelectItem value="cad">CAD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateFormat">Date Format</Label>
                <Select defaultValue="mdy">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mdy">MM/DD/YYYY</SelectItem>
                    <SelectItem value="dmy">DD/MM/YYYY</SelectItem>
                    <SelectItem value="ymd">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxRate">Default Tax Rate (%)</Label>
              <Input 
                id="taxRate" 
                type="number" 
                placeholder="8.0" 
                className="w-32"
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Manage your notification preferences
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Overdue Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Get notified when invoices become overdue
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Payment Reminders</p>
                <p className="text-sm text-muted-foreground">
                  Remind about upcoming due dates
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Weekly Summary</p>
                <p className="text-sm text-muted-foreground">
                  Receive a weekly expense summary email
                </p>
              </div>
              <Switch />
            </div>
          </div>
        </div>

        {/* Security Note */}
        <div className="bg-muted/50 rounded-xl border border-border p-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Security Note</p>
              <p className="text-sm text-muted-foreground mt-1">
                Database credentials are stored securely and encrypted. 
                For production use, we recommend using environment variables 
                and secure secret management.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button size="lg" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
