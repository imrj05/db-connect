import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SAMPLE_DATA = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com", balance: 1250.5, created_at: "2024-03-10 10:20:30", status: "active" },
  { id: 2, name: "Bob Smith", email: "bob@example.com", balance: null, created_at: "2024-03-11 11:30:45", status: "pending" },
  { id: 3, name: "Charlie Brown", email: "charlie@example.com", balance: 2300.75, created_at: "2024-03-12 14:15:00", status: "inactive" },
  { id: 4, name: "Diana Prince", email: "diana@example.com", balance: 0.0, created_at: "2024-03-13 09:05:12", status: "active" },
  { id: 5, name: "Edward Norton", email: "edward@example.com", balance: -50.0, created_at: null, status: "suspended" },
];

export function LiveMockup() {
  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* 1. Title Bar */}
      <div className="h-9 px-3 flex items-center justify-between bg-sidebar border-b border-border shrink-0 select-none">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 px-1">
             <div className="size-3 rounded-full bg-[#ff5f57]" />
             <div className="size-3 rounded-full bg-[#febc2e]" />
             <div className="size-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">db-connect — example_app</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* 2. Sidebar */}
        <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col pt-4">
          <div className="px-4 mb-4">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Databases</h3>
          </div>
          <div className="space-y-0.5 px-2">
            {["example_app", "postgres", "test_db"].map((db) => (
              <div
                key={db}
                className={cn(
                  "px-2 py-1.5 rounded-sm text-sm cursor-pointer transition-colors",
                  db === "example_app" ? "bg-accent text-sidebar-active" : "text-sidebar-item hover:bg-sidebar-accent"
                )}
              >
                {db}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-card">
          {/* 3. Filter Bar */}
          <div className="h-10 px-4 flex items-center gap-4 bg-card border-b border-border shrink-0">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-muted-foreground">Filter</span>
              <div className="h-6 flex-1 bg-background border border-input rounded px-2 flex items-center">
                <span className="text-xs text-muted-foreground italic">e.g. name = 'Alice'</span>
              </div>
            </div>
          </div>

          {/* 4. Toolbar */}
          <div className="h-11 px-4 flex items-center gap-3 bg-card border-b border-border shrink-0">
            <button className="h-7 px-3 bg-background dark:bg-muted border border-border rounded text-xs hover:bg-background/80 dark:hover:bg-muted/80 transition-colors">Refresh</button>
            <button className="h-7 px-3 bg-background dark:bg-muted border border-border rounded text-xs opacity-50 cursor-not-allowed">Commit</button>
            <div className="w-px h-4 bg-border-app mx-1" />
            <button className="size-7 flex items-center justify-center bg-background dark:bg-muted border border-border rounded hover:bg-background/80 dark:hover:bg-muted/80 transition-colors text-xs">+</button>
            <button className="size-7 flex items-center justify-center bg-background dark:bg-muted border border-border rounded hover:bg-background/80 dark:hover:bg-muted/80 transition-colors text-xs">-</button>
          </div>

          <div className="flex-1 overflow-auto bg-card scrollbar-thin">
            <Table className="w-full border-collapse">
              <TableHeader className="bg-card">
                <TableRow>
                  <TableHead className="w-15">id</TableHead>
                  <TableHead>name</TableHead>
                  <TableHead>email</TableHead>
                  <TableHead align="right">balance</TableHead>
                  <TableHead>created_at</TableHead>
                  <TableHead>status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_DATA.map((row, idx) => (
                  <TableRow key={row.id} className={cn(idx === 1 && "bg-muted", idx % 2 === 1 && "bg-muted")}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell align="right">
                      {row.balance === null ? "NULL" : row.balance.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {row.created_at === null ? "NULL" : row.created_at}
                    </TableCell>
                    <TableCell>{row.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 6. Bottom Bar */}
          <div className="h-8 px-4 flex items-center justify-between bg-background border-t border-border shrink-0 select-none">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>5 rows</span>
              <span className="text-muted-foreground">|</span>
              <span className="text-chart-1 underline cursor-pointer">Export CSV</span>
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
              UTF-8 • PSQL
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
