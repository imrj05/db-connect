import { Loader2, X, Plus, Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FilterCondition, FilterOp } from "@/types";

const OP_LABELS: Record<FilterOp, string> = {
  "=": "equals",
  "!=": "not equals",
  ">": "greater than",
  "<": "less than",
  ">=": "greater or equal",
  "<=": "less or equal",
  "LIKE": "contains",
  "NOT LIKE": "not contains",
  "IS NULL": "is empty",
  "IS NOT NULL": "is not empty",
};

export function FilterBar({
  viewMode,
  filters,
  availableCols,
  filterLoading,
  onFilterChange,
  onRemoveFilter,
  onAddFilter,
  onApply,
}: {
  viewMode: "data" | "form" | "structure" | "er";
  filters: FilterCondition[];
  availableCols: string[];
  filterLoading: boolean;
  onFilterChange: (id: string, partial: Partial<FilterCondition>) => void;
  onRemoveFilter: (id: string) => void;
  onAddFilter: () => void;
  onApply: () => void;
}) {
  if (viewMode !== "data") return null;

  // Check if all filters have a column selected
  const allFiltersHaveColumns = filters.every((f) => f.col && f.col !== "");

  return (
    <div className="shrink-0 border-b border-border-subtle bg-surface-2/82">
      <div className="flex flex-col">
        {filters.map((f, i) => (
          <div
            key={f.id}
            className="flex items-center gap-2 px-3 py-2 hover:bg-surface-3/72 transition-colors"
          >
            {/* Join indicator for first row */}
            {i === 0 ? (
              <div className="flex h-8 w-10 items-center justify-center">
                {filters.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() =>
                      onFilterChange(filters[1].id, {
                        join: filters[1].join === "AND" ? "OR" : "AND",
                      })
                    }
                    className="size-8 text-foreground/60 hover:bg-surface-selected/82 hover:text-foreground"
                    title="Toggle AND/OR"
                    aria-label="Toggle first filter join"
                  >
                    <ChevronDown />
                  </Button>
                ) : null}
              </div>
            ) : (
              <ToggleGroup
                type="single"
                value={f.join}
                onValueChange={(value) => {
                  if (value === "AND" || value === "OR") {
                    onFilterChange(f.id, { join: value });
                  }
                }}
                variant="outline"
                size="sm"
                className="w-10"
              >
                <ToggleGroupItem
                  value={f.join}
                  className="h-8 w-10 rounded-[4px] px-0 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  aria-label={`Join with ${f.join}`}
                >
                  {f.join}
                </ToggleGroupItem>
              </ToggleGroup>
            )}

            {/* Column select */}
            <NativeSelect
              value={f.col}
              aria-label="Filter column"
              onChange={(e) => onFilterChange(f.id, { col: e.target.value })}
              className="min-w-[140px] max-w-[220px] flex-1"
            >
              <NativeSelectOption value="">Select column</NativeSelectOption>
              {/* Include selected column even if not in availableCols to preserve selection */}
              {f.col && !availableCols.includes(f.col) && (
                <NativeSelectOption key={f.col} value={f.col}>
                  {f.col}
                </NativeSelectOption>
              )}
              {availableCols.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {c}
                </NativeSelectOption>
              ))}
            </NativeSelect>

            {/* Operator select */}
            <NativeSelect
              value={f.op}
              aria-label="Filter operator"
              onChange={(e) =>
                onFilterChange(f.id, { op: e.target.value as FilterOp })
              }
              className="min-w-[130px] max-w-[170px] flex-1"
            >
              {(
                [
                  "=",
                  "!=",
                  ">",
                  "<",
                  ">=",
                  "<=",
                  "LIKE",
                  "NOT LIKE",
                  "IS NULL",
                  "IS NOT NULL",
                ] as FilterOp[]
              ).map((op) => (
                <NativeSelectOption key={op} value={op}>
                  {OP_LABELS[op]}
                </NativeSelectOption>
              ))}
            </NativeSelect>

            {/* Value input */}
            {f.op !== "IS NULL" && f.op !== "IS NOT NULL" ? (
              <Input
                value={f.value}
                onChange={(e) =>
                  onFilterChange(f.id, { value: e.target.value })
                }
                onKeyDown={(e) => e.key === "Enter" && onApply()}
                placeholder="Enter value…"
                className="h-8 text-[12px] flex-[2] min-w-[170px] bg-surface-elevated/94"
              />
            ) : (
              <div className="h-8 flex-[2] min-w-[170px] flex items-center text-[12px] text-foreground/52 italic px-2.5">
                No value needed
              </div>
            )}

            {/* Action buttons - only on first row */}
            {i === 0 ? (
              <div className="flex items-center gap-1 shrink-0">
                {filters.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onRemoveFilter(f.id)}
                  className="h-8 w-8 text-foreground/56 hover:text-destructive hover:bg-destructive/10"
                  >
                    <X size={14} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onAddFilter}
                  className="h-8 w-8 text-foreground/56 hover:text-foreground hover:bg-surface-3"
                >
                  <Plus size={14} />
                </Button>
                <Button
                  size="sm"
                  onClick={onApply}
                  disabled={filterLoading || filters.length === 0 || !allFiltersHaveColumns}
                  className="h-8 px-3 bg-primary hover:bg-primary/92 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed gap-1.5 text-[11px] font-medium rounded-[4px] shadow-xs"
                >
                  {filterLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                  Apply
                </Button>
              </div>
            ) : (
              /* Remove button for other rows */
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onRemoveFilter(f.id)}
                  className="h-8 w-8 text-foreground/56 hover:text-destructive hover:bg-destructive/10"
                >
                  <X size={14} />
                </Button>
                <div className="w-14" /> {/* Spacer to align with first row */}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
