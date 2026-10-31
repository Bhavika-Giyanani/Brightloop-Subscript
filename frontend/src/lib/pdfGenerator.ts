import jsPDF from 'jspdf';
import { Invoice, Customer, Payment } from '../types/index.ts';

export function generateInvoicePDF(
  invoice: Invoice,
  customer?: Customer,
  payments: Payment[] = []
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Primary Colors
  const primaryNavy = [11, 19, 43]; // #0B132B
  const accentIndigo = [79, 70, 229]; // #4F46E5
  const slateText = [51, 65, 85];
  const mutedText = [100, 116, 139];
  const borderGrey = [226, 232, 240];
  const bgLight = [248, 250, 252];

  // 1. Top Header Banner
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Brand Logo Mark
  doc.setFillColor(accentIndigo[0], accentIndigo[1], accentIndigo[2]);
  doc.roundedRect(margin, 6, 16, 16, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('B', margin + 5.5, 17.5);

  // Brand Name & Subtitle
  doc.setFontSize(15);
  doc.text('Brightloop Software', margin + 21, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(199, 210, 254);
  doc.text('Cloud Subscriptions & Invoicing Platform', margin + 21, 19);

  // Document Type Header on Right
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('TAX INVOICE', pageWidth - margin, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(224, 231, 255);
  doc.text(invoice.invoiceNumber, pageWidth - margin, 19, { align: 'right' });

  let y = 36;

  // 2. Company Info (Left) & Invoice Meta (Right)
  doc.setTextColor(slateText[0], slateText[1], slateText[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Brightloop Technologies Pvt Ltd', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Tower C, Cyber City, DLF Phase 2', margin, y + 4.5);
  doc.text('Gurugram, Haryana 122002, India', margin, y + 8.5);
  doc.text('Email: billing@brightloop.io | GSTIN: 07AAACB2948F1Z1', margin, y + 12.5);

  // Invoice Meta Box on Right
  const metaBoxX = pageWidth - margin - 70;
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.roundedRect(metaBoxX, y - 2, 70, 20, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Invoice Date:', metaBoxX + 4, y + 3);
  doc.setTextColor(slateText[0], slateText[1], slateText[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.invoiceDate, metaBoxX + 66, y + 3, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Payment Due:', metaBoxX + 4, y + 8);
  doc.setTextColor(225, 29, 72); // rose red for due date
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.dueDate, metaBoxX + 66, y + 8, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Status:', metaBoxX + 4, y + 13);
  
  if (invoice.status === 'PAID') {
    doc.setTextColor(16, 185, 129); // green
  } else if (invoice.status === 'CONFIRMED') {
    doc.setTextColor(59, 130, 246); // blue
  } else {
    doc.setTextColor(100, 116, 139);
  }
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.status, metaBoxX + 66, y + 13, { align: 'right' });

  y += 24;

  // 3. "Billed To" & "Subscription Cycle" Card
  const halfWidth = (pageWidth - margin * 2 - 4) / 2;

  // Billed To Box
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.roundedRect(margin, y, halfWidth, 26, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentIndigo[0], accentIndigo[1], accentIndigo[2]);
  doc.text('BILLED TO', margin + 4, y + 5);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(customer?.companyName || 'Valued Customer', margin + 4, y + 10.5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(slateText[0], slateText[1], slateText[2]);
  doc.text(`Attn: ${customer?.name || 'Authorized Representative'}`, margin + 4, y + 15);
  doc.text(`${customer?.billingAddress || ''}, ${customer?.city || ''} ${customer?.country || ''}`, margin + 4, y + 19);
  if (customer?.taxNumber) {
    doc.text(`GST/Tax ID: ${customer.taxNumber}`, margin + 4, y + 23);
  }

  // Subscription Details Box
  const subBoxX = margin + halfWidth + 4;
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.roundedRect(subBoxX, y, halfWidth, 26, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentIndigo[0], accentIndigo[1], accentIndigo[2]);
  doc.text('SUBSCRIPTION & BILLING PERIOD', subBoxX + 4, y + 5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Subscription Ref:', subBoxX + 4, y + 11);
  doc.setTextColor(slateText[0], slateText[1], slateText[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.subscriptionId || 'Direct Billing', subBoxX + halfWidth - 4, y + 11, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Billing Period Start:', subBoxX + 4, y + 16.5);
  doc.setTextColor(slateText[0], slateText[1], slateText[2]);
  doc.text(invoice.billingPeriodStart, subBoxX + halfWidth - 4, y + 16.5, { align: 'right' });

  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Billing Period End:', subBoxX + 4, y + 22);
  doc.setTextColor(slateText[0], slateText[1], slateText[2]);
  doc.text(invoice.billingPeriodEnd, subBoxX + halfWidth - 4, y + 22, { align: 'right' });

  y += 32;

  // 4. Line Items Table Header
  const colDescX = margin + 4;
  const colQtyX = pageWidth - margin - 65;
  const colUnitPriceX = pageWidth - margin - 35;
  const colTotalX = pageWidth - margin - 4;

  doc.setFillColor(accentIndigo[0], accentIndigo[1], accentIndigo[2]);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 7.5, 1.5, 1.5, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Item Description', colDescX, y + 5.2);
  doc.text('Qty', colQtyX, y + 5.2, { align: 'center' });
  doc.text('Unit Price', colUnitPriceX, y + 5.2, { align: 'right' });
  doc.text('Amount (INR)', colTotalX, y + 5.2, { align: 'right' });

  y += 7.5;

  // Line Items Rows
  doc.setFontSize(8);
  invoice.lines.forEach((line, index) => {
    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(252, 253, 255);
    } else {
      doc.setFillColor(245, 247, 250);
    }
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
    doc.setDrawColor(235, 240, 245);
    doc.line(margin, y + 7, pageWidth - margin, y + 7);

    doc.setTextColor(slateText[0], slateText[1], slateText[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(line.description, colDescX, y + 4.8);
    doc.text(String(line.quantity), colQtyX, y + 4.8, { align: 'center' });
    doc.text(`₹${line.unitPrice.toLocaleString('en-IN')}`, colUnitPriceX, y + 4.8, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`₹${line.lineTotal.toLocaleString('en-IN')}`, colTotalX, y + 4.8, { align: 'right' });

    y += 7;
  });

  y += 4;

  // 5. Totals Breakdown Card (Right) & Notes / Banking Remittance (Left)
  const breakdownWidth = 75;
  const breakdownX = pageWidth - margin - breakdownWidth;

  // Left side: Banking & Payment info
  const infoWidth = pageWidth - margin * 2 - breakdownWidth - 6;
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.roundedRect(margin, y, infoWidth, 38, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentIndigo[0], accentIndigo[1], accentIndigo[2]);
  doc.text('PAYMENT REMITTANCE DETAILS', margin + 4, y + 5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(slateText[0], slateText[1], slateText[2]);
  doc.text('Contact your account administrator for bank transfer details.', margin + 4, y + 12);

  doc.setFontSize(7);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Please include invoice reference in the transaction remarks.', margin + 4, y + 32);

  // Right side: Financial Totals Box
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.roundedRect(breakdownX, y, breakdownWidth, 38, 2, 2, 'FD');

  let curY = y + 5;
  doc.setFontSize(8);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', breakdownX + 4, curY);
  doc.setTextColor(slateText[0], slateText[1], slateText[2]);
  doc.text(`₹${invoice.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, breakdownX + breakdownWidth - 4, curY, { align: 'right' });

  if (invoice.discountBreakdown && invoice.discountBreakdown.amount > 0) {
    curY += 4.5;
    doc.setTextColor(16, 185, 129); // green
    doc.text(`Discount (${invoice.discountBreakdown.code || 'Promo'}):`, breakdownX + 4, curY);
    doc.text(`-₹${invoice.discountBreakdown.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, breakdownX + breakdownWidth - 4, curY, { align: 'right' });
  }

  invoice.taxBreakdown.forEach(t => {
    curY += 4.5;
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text(`${t.taxName} (${t.rate}%):`, breakdownX + 4, curY);
    doc.setTextColor(slateText[0], slateText[1], slateText[2]);
    doc.text(`+₹${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, breakdownX + breakdownWidth - 4, curY, { align: 'right' });
  });

  curY += 6;
  doc.setDrawColor(accentIndigo[0], accentIndigo[1], accentIndigo[2]);
  doc.line(breakdownX + 4, curY - 2, breakdownX + breakdownWidth - 4, curY - 2);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('Total Amount:', breakdownX + 4, curY + 2);
  doc.setTextColor(accentIndigo[0], accentIndigo[1], accentIndigo[2]);
  doc.text(`₹${invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, breakdownX + breakdownWidth - 4, curY + 2, { align: 'right' });

  curY += 6.5;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Paid to Date:', breakdownX + 4, curY);
  doc.setTextColor(16, 185, 129);
  doc.setFont('helvetica', 'bold');
  doc.text(`₹${invoice.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, breakdownX + breakdownWidth - 4, curY, { align: 'right' });

  curY += 4.5;
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.setFont('helvetica', 'normal');
  doc.text('Outstanding Balance:', breakdownX + 4, curY);
  doc.setTextColor(invoice.outstandingAmount > 0 ? 217 : 16, invoice.outstandingAmount > 0 ? 119 : 185, invoice.outstandingAmount > 0 ? 6 : 129);
  doc.setFont('helvetica', 'bold');
  doc.text(`₹${invoice.outstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, breakdownX + breakdownWidth - 4, curY, { align: 'right' });

  y += 42;

  // 6. Payment Receipts section (if any)
  if (payments.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentIndigo[0], accentIndigo[1], accentIndigo[2]);
    doc.text('RECORDED PAYMENT RECEIPTS', margin, y);
    y += 3.5;

    payments.forEach(p => {
      doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 6, 1, 1, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(slateText[0], slateText[1], slateText[2]);
      doc.text(`${p.paymentNumber} • ${p.paymentMethod.replace('_', ' ')} • Ref: ${p.transactionReference} • Date: ${p.paymentDate}`, margin + 3, y + 4.2);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(`₹${p.amount.toLocaleString('en-IN')}`, pageWidth - margin - 3, y + 4.2, { align: 'right' });
      y += 7.5;
    });
  }

  // 7. Footer Notice
  const footerY = pageHeight - 12;
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('This is a computer-generated tax invoice issued by Brightloop Technologies Pvt Ltd and is legally valid without signature.', margin, footerY);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, footerY, { align: 'right' });

  // Save the PDF file to trigger browser download
  const sanitizedNumber = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${sanitizedNumber}.pdf`);
}
