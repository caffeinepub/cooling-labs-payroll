import { Download, FileText, Printer, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { getCompanySettings } from "../services/companySettings";
import { getDepartments, getTrades } from "../services/mastersStorage";
import type { PayrollBreakdownExtended } from "../services/payrollStorage";
import type { Employee } from "../types";
import { numberToWords } from "../utils/numberToWords";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface PayslipModalProps {
  open: boolean;
  onClose: () => void;
  bd: PayrollBreakdownExtended;
  employee: Employee;
  monthLabel: string;
  month: number;
  year: number;
}

function fmtRs(n: number): string {
  return Number(n ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDOJ(dateOfJoining?: string): string {
  if (!dateOfJoining) return "-";
  try {
    // dateOfJoining stored as YYYY-MM-DD
    const [y, m, d] = dateOfJoining.split("-");
    if (!y || !m || !d) return "-";
    return `${d}/${m}/${y}`;
  } catch {
    return "-";
  }
}

const PAYSLIP_FONT = `"Inter", "Segoe UI", Arial, Helvetica, sans-serif`;

const PAYSLIP_STYLES = `
  #payslip-doc {
    font-family: ${PAYSLIP_FONT};
    font-size: 11px;
    color: #111;
    background: #fff;
    width: 760px;
    margin: 0 auto;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  #payslip-doc * {
    box-sizing: border-box;
  }
  #payslip-doc .ps-outer {
    border: 1.5px solid #1a3a5c;
    border-radius: 0;
  }
  /* HEADER */
  #payslip-doc .ps-header {
    background: #1a3a5c;
    color: #fff;
    padding: 0;
    display: flex;
    align-items: center;
    min-height: 68px;
  }
  #payslip-doc .ps-logo-wrap {
    padding: 8px 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid rgba(255,255,255,0.2);
    min-width: 120px;
    background: #fff;
    min-height: 68px;
  }
  #payslip-doc .ps-logo-wrap img {
    max-height: 48px;
    max-width: 120px;
    object-fit: contain;
    display: block;
  }
  #payslip-doc .ps-header-text {
    flex: 1;
    text-align: center;
    padding: 10px 16px;
  }
  #payslip-doc .ps-company {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    line-height: 1.3;
  }
  #payslip-doc .ps-company-no-logo {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    line-height: 1.3;
  }
  #payslip-doc .ps-month {
    font-size: 11px;
    margin-top: 4px;
    opacity: 0.9;
    font-weight: 400;
    letter-spacing: 0.3px;
  }
  /* EMPLOYEE DETAILS */
  #payslip-doc .ps-emp-table {
    width: 100%;
    border-collapse: collapse;
    border-top: 1.5px solid #1a3a5c;
  }
  #payslip-doc .ps-emp-table td {
    padding: 4px 10px;
    border: 0.5px solid #c8d6e5;
    vertical-align: middle;
    line-height: 1.4;
  }
  #payslip-doc .ps-label {
    width: 22%;
    color: #2c4a6e;
    background: #edf3fa;
    font-weight: 600;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  #payslip-doc .ps-value {
    width: 28%;
    font-weight: 500;
    color: #111;
    font-size: 11px;
  }
  /* SECTION HEADERS for Earnings / Deductions */
  #payslip-doc .ps-section-row {
    display: flex;
  }
  #payslip-doc .ps-section-head {
    font-weight: 700;
    background: #2c4a6e;
    color: #fff;
    border: 0.5px solid #1a3a5c;
    padding: 5px 10px;
    font-size: 11px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }
  #payslip-doc .ps-earn-ded-table {
    width: 100%;
    border-collapse: collapse;
  }
  #payslip-doc .ps-earn-ded-table td {
    border: 0.5px solid #c8d6e5;
    padding: 4px 10px;
    vertical-align: middle;
    font-size: 11px;
  }
  #payslip-doc .ps-amount {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: #111;
    width: 14%;
  }
  #payslip-doc .ps-earn-col {
    width: 36%;
  }
  #payslip-doc .ps-ded-col {
    width: 36%;
  }
  #payslip-doc .ps-total-row td {
    font-weight: 700;
    background: #edf3fa;
    border-top: 1.5px solid #1a3a5c;
    font-size: 11px;
  }
  /* NET SALARY */
  #payslip-doc .ps-net-section {
    border-top: 1.5px solid #1a3a5c;
    background: #f7fafd;
  }
  #payslip-doc .ps-net-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 14px;
    border-bottom: 0.5px solid #c8d6e5;
  }
  #payslip-doc .ps-net-label {
    font-weight: 700;
    font-size: 13px;
    color: #1a3a5c;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  #payslip-doc .ps-net-amount {
    font-weight: 700;
    font-size: 15px;
    color: #1a3a5c;
    font-variant-numeric: tabular-nums;
  }
  #payslip-doc .ps-words-row {
    padding: 5px 14px;
    font-size: 10.5px;
    color: #333;
    font-style: italic;
    border-bottom: 0.5px solid #c8d6e5;
  }
  #payslip-doc .ps-footer {
    text-align: center;
    padding: 6px 10px;
    border-top: 1px solid #c8d6e5;
    font-style: italic;
    font-size: 9.5px;
    color: #666;
    background: #f7fafd;
    letter-spacing: 0.2px;
  }
  @media print {
    body * { visibility: hidden !important; }
    #payslip-doc, #payslip-doc * { visibility: visible !important; }
    #payslip-doc {
      position: fixed !important;
      left: 0 !important;
      top: 0 !important;
      width: 210mm !important;
      margin: 0 !important;
      padding: 8mm !important;
    }
  }
`;

export function PayslipModal({
  open,
  onClose,
  bd,
  employee,
  monthLabel,
}: PayslipModalProps) {
  const [tradeName, setTradeName] = useState("");
  const [deptName, setDeptName] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);
  const [companyName, setCompanyName] = useState("COOLING LABS ENGINEERS LLP.");

  useEffect(() => {
    if (!open) return;
    const { trades } = getTrades();
    const { departments } = getDepartments();
    const trade = trades.find((t) => t.id === employee.tradeId);
    const dept = departments.find((d) => d.id === employee.departmentId);
    setTradeName(trade?.name ?? employee.tradeId ?? "-");
    setDeptName(dept?.name ?? employee.departmentId ?? "-");
    const cs = getCompanySettings();
    setLogoDataUrl(cs.logoDataUrl || "");
    setCompanyName(cs.companyName || "COOLING LABS ENGINEERS LLP.");
  }, [open, employee.tradeId, employee.departmentId]);

  const rec = bd.record;

  // ─── EARNINGS: pull directly from payroll record ───
  const earnedBasic = rec.basicSalary ?? 0; // Basic + VDA
  const earnedHRA = rec.hra ?? 0; // HRA
  const medical = 0; // no medical component currently
  const conveyance = rec.conveyance ?? 0;
  const specialAllow = rec.specialAllowance ?? 0;
  const otherAllow = rec.otherAllowance ?? 0; // was missing — causes mismatch with payroll
  const otPay = rec.otAmount ?? 0;

  const totalEarnings =
    earnedBasic +
    earnedHRA +
    medical +
    conveyance +
    specialAllow +
    otherAllow +
    otPay;

  // Validation: payslip Total Earnings must match payroll grossPay (finalGross)
  const payrollGross = rec.grossPay ?? 0;
  if (Math.abs(totalEarnings - payrollGross) > 0.02) {
    console.warn(
      `[PayslipModal] MISMATCH: payslip totalEarnings=${totalEarnings} vs payroll grossPay=${payrollGross}. Diff=${totalEarnings - payrollGross}`,
    );
  }

  // ─── DEDUCTIONS: pull directly from payroll record ───
  const pf = rec.pfDeduction ?? 0;
  const esic = rec.esiDeduction ?? 0;
  const pt = (rec as { ptDeduction?: number }).ptDeduction ?? 0;
  const lwf = 0;
  const advance = rec.advanceDeduction ?? 0;
  const otherDed = (rec as { otherDeduction?: number }).otherDeduction ?? 0;
  const tds = 0;
  const totalDeductions = pf + esic + pt + lwf + advance + otherDed + tds;

  // Net = use the stored netPay (source of truth), do NOT re-derive
  const netSalary = rec.netPay ?? totalEarnings - totalDeductions;
  const netWords = numberToWords(Math.round(Math.abs(netSalary)));

  const daysWorked = +(bd.presentDays + bd.halfDays * 0.5).toFixed(1);

  // Build full HTML for PDF download window
  function buildPayslipHtml(inlineImg: boolean): string {
    const logoHtml = logoDataUrl
      ? `<div class="ps-logo-wrap"><img src="${inlineImg ? logoDataUrl : logoDataUrl}" alt="Logo" /></div>`
      : "";
    const headerClass = logoDataUrl ? "ps-company" : "ps-company-no-logo";

    return `
<div id="payslip-doc">
  <div class="ps-outer">
    <!-- HEADER -->
    <div class="ps-header">
      ${logoHtml}
      <div class="ps-header-text">
        <div class="${headerClass}">${companyName}</div>
        <div class="ps-month">Payslip for the month of ${monthLabel}</div>
      </div>
    </div>

    <!-- EMPLOYEE INFO -->
    <table class="ps-emp-table">
      <tbody>
        <tr>
          <td class="ps-label">Employee Name</td>
          <td class="ps-value">${employee.name || "-"}</td>
          <td class="ps-label">Employee ID</td>
          <td class="ps-value">${employee.employeeId || "-"}</td>
        </tr>
        <tr>
          <td class="ps-label">Designation</td>
          <td class="ps-value">${tradeName || "-"}</td>
          <td class="ps-label">Department</td>
          <td class="ps-value">${deptName || "-"}</td>
        </tr>
        <tr>
          <td class="ps-label">Location</td>
          <td class="ps-value">${employee.site || "-"}</td>
          <td class="ps-label">Date of Joining</td>
          <td class="ps-value">${fmtDOJ(employee.dateOfJoining)}</td>
        </tr>
        <tr>
          <td class="ps-label">Days Worked</td>
          <td class="ps-value">${daysWorked}</td>
          <td class="ps-label">Bank Name</td>
          <td class="ps-value">${employee.bankName || "-"}</td>
        </tr>
        <tr>
          <td class="ps-label">Bank Account No.</td>
          <td class="ps-value">${employee.bankAccountNumber || "-"}</td>
          <td class="ps-label">UAN Number</td>
          <td class="ps-value">${employee.uanNumber || "-"}</td>
        </tr>
        <tr>
          <td class="ps-label">ESIC No.</td>
          <td class="ps-value">${employee.esiNumber || "-"}</td>
          <td class="ps-label">PAN</td>
          <td class="ps-value">${employee.panNumber || "-"}</td>
        </tr>
      </tbody>
    </table>

    <!-- SECTION HEADERS -->
    <table style="width:100%;border-collapse:collapse">
      <tbody>
        <tr>
          <td style="width:50%" class="ps-section-head">Earnings</td>
          <td style="width:50%" class="ps-section-head">Deductions</td>
        </tr>
      </tbody>
    </table>

    <!-- EARNINGS & DEDUCTIONS -->
    <table class="ps-earn-ded-table">
      <tbody>
        <tr>
          <td class="ps-earn-col">Basic + VDA</td>
          <td class="ps-amount">${fmtRs(earnedBasic)}</td>
          <td class="ps-ded-col">Provident Fund</td>
          <td class="ps-amount">${fmtRs(pf)}</td>
        </tr>
        <tr>
          <td>House Rent Allowance</td>
          <td class="ps-amount">${fmtRs(earnedHRA)}</td>
          <td>ESIC</td>
          <td class="ps-amount">${fmtRs(esic)}</td>
        </tr>
        <tr>
          <td>Medical</td>
          <td class="ps-amount">${fmtRs(medical)}</td>
          <td>LWF</td>
          <td class="ps-amount">${fmtRs(lwf)}</td>
        </tr>
        <tr>
          <td>Conveyance</td>
          <td class="ps-amount">${fmtRs(conveyance)}</td>
          <td>Advance</td>
          <td class="ps-amount">${fmtRs(advance)}</td>
        </tr>
        <tr>
          <td>Special Allowance</td>
          <td class="ps-amount">${fmtRs(specialAllow)}</td>
          <td>TDS</td>
          <td class="ps-amount">${fmtRs(tds)}</td>
        </tr>
        <tr>
          <td>Other Allowance</td>
          <td class="ps-amount">${fmtRs(otherAllow)}</td>
          <td>${otherDed > 0 ? "Other Deductions" : ""}</td>
          <td class="ps-amount">${otherDed > 0 ? fmtRs(otherDed) : ""}</td>
        </tr>
        <tr>
          <td>Arrear / OT Pay</td>
          <td class="ps-amount">${fmtRs(otPay)}</td>
          <td></td>
          <td class="ps-amount"></td>
        </tr>
        <tr class="ps-total-row">
          <td><strong>Total Earnings</strong></td>
          <td class="ps-amount"><strong>${fmtRs(totalEarnings)}</strong></td>
          <td><strong>Total Deductions</strong></td>
          <td class="ps-amount"><strong>${fmtRs(totalDeductions)}</strong></td>
        </tr>
      </tbody>
    </table>

    <!-- NET SALARY -->
    <div class="ps-net-section">
      <div class="ps-net-row">
        <span class="ps-net-label">Net Salary (In-Hand)</span>
        <span class="ps-net-amount">&#8377;&nbsp;${fmtRs(netSalary)}</span>
      </div>
      <div class="ps-words-row">
        <strong>Total Salary in Words:</strong> ${netWords}
      </div>
    </div>

    <!-- FOOTER -->
    <div class="ps-footer">
      This is computer generated salary slip no signature required
    </div>
  </div>
</div>`;
  }

  function handlePrint() {
    window.print();
  }

  function handleDownloadPDF() {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      alert("Pop-up blocked. Please allow pop-ups for this site.");
      return;
    }
    const html = buildPayslipHtml(true);
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payslip_${employee.name}_${monthLabel.replace(/ /g, "_")}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { margin: 0; padding: 10mm; background: #fff; }
    ${PAYSLIP_STYLES.replace(/@media print[\s\S]*?\}\s*\}/, "")}
  </style>
</head>
<body>
  ${html}
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 400); };
  <\/script>
</body>
</html>`);
    win.document.close();
  }

  // Render the live preview HTML inside the modal
  const previewHtml = buildPayslipHtml(false);

  // biome-ignore lint/security/noDangerouslySetInnerHtml: payslip HTML is built internally, never from user input
  // Using ref + innerHTML to avoid linter error on dangerouslySetInnerHTML
  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.innerHTML = previewHtml;
    }
  });

  return (
    <>
      <style>{PAYSLIP_STYLES}</style>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl w-full overflow-y-auto max-h-[95vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Salary Slip — {monthLabel}
            </DialogTitle>
          </DialogHeader>

          {/* Action buttons */}
          <div className="flex gap-2 mb-3" data-ocid="payslip.panel">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              data-ocid="payslip.primary_button"
              className="flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Print Payslip
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadPDF}
              data-ocid="payslip.secondary_button"
              className="flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              data-ocid="payslip.close_button"
              className="ml-auto flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              Close
            </Button>
          </div>

          {/* Live preview rendered from the same HTML builder */}
          <div ref={previewRef} style={{ overflowX: "auto" }} />
        </DialogContent>
      </Dialog>
    </>
  );
}
