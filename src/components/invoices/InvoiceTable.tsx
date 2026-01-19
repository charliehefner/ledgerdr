import { Link } from "react-router-dom";
import { MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
import { StatusBadge, InvoiceStatus } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/formatters";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendor: string;
  description: string;
  category: string;
  amount: number;
  tax: number;
  total: number;
  date: string;
  dueDate: string;
  paymentDate?: string;
  status: InvoiceStatus;
}

interface InvoiceTableProps {
  invoices: Invoice[];
  onDelete?: (id: string) => void;
}

export function InvoiceTable({ invoices, onDelete }: InvoiceTableProps) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <table className="data-table">
        <thead className="bg-muted/50">
          <tr>
            <th>Invoice #</th>
            <th>Vendor</th>
            <th>Category</th>
            <th>Date</th>
            <th>Due Date</th>
            <th className="text-right">Amount</th>
            <th>Status</th>
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="group">
              <td>
                <Link 
                  to={`/invoices/${invoice.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {invoice.invoiceNumber}
                </Link>
              </td>
              <td>
                <div>
                  <p className="font-medium">{invoice.vendor}</p>
                  <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {invoice.description}
                  </p>
                </div>
              </td>
              <td>
                <span className="inline-flex px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
                  {invoice.category}
                </span>
              </td>
              <td className="text-muted-foreground">{formatDate(invoice.date)}</td>
              <td className="text-muted-foreground">{formatDate(invoice.dueDate)}</td>
              <td className="amount">{formatCurrency(invoice.total)}</td>
              <td>
                <StatusBadge status={invoice.status} />
              </td>
              <td>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/invoices/${invoice.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={`/invoices/${invoice.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete?.(invoice.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {invoices.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No invoices found</p>
        </div>
      )}
    </div>
  );
}
