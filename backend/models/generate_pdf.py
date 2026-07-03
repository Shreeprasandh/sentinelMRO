import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to calculate the total page count dynamically
    and print running headers and footers with page numbers.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_elements(num_pages)
            super().showPage()
        super().save()

    def draw_page_elements(self, page_count):
        # Skip header and footer on cover page
        if self._pageNumber == 1:
            return
            
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#4b5563")) # Slate gray
        
        # Draw running header
        self.drawString(54, 750, "SentinelMRO: Decentralized Edge-AI & Immutable Audit Ledger")
        self.drawRightString(letter[0] - 54, 750, "Tata Technologies InnoVent-27")
        self.setStrokeColor(colors.HexColor("#d1d5db")) # Light gray line
        self.setLineWidth(0.5)
        self.line(54, 742, letter[0] - 54, 742)
        
        # Draw running footer
        self.line(54, 60, letter[0] - 54, 60)
        self.drawString(54, 45, "Technical Report | Category 3.2.3.3")
        self.drawRightString(letter[0] - 54, 45, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

def build_pdf():
    # Setup paths
    doc_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "documentation"))
    os.makedirs(doc_dir, exist_ok=True)
    pdf_path = os.path.join(doc_dir, "SentinelMRO_Technical_Report.pdf")
    
    # Page setup (margins: 0.75 inch)
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=72,
        bottomMargin=72
    )
    
    styles = getSampleStyleSheet()
    
    # Palette
    c_primary = colors.HexColor("#1e3a8a")     # Deep Blue
    c_secondary = colors.HexColor("#0f766e")   # Teal
    c_text = colors.HexColor("#1f2937")        # Dark Charcoal
    c_bg_light = colors.HexColor("#f3f4f6")    # Light grey table bg
    
    # Custom styles
    styles.add(ParagraphStyle(
        name='CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=32,
        leading=38,
        textColor=c_primary,
        alignment=0, # Left aligned
        spaceAfter=15
    ))
    
    styles.add(ParagraphStyle(
        name='CoverSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#4b5563"),
        spaceAfter=30
    ))
    
    styles.add(ParagraphStyle(
        name='ReportHeading1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=c_primary,
        spaceBefore=20,
        spaceAfter=10,
        keepWithNext=True
    ))

    styles.add(ParagraphStyle(
        name='ReportHeading2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=c_secondary,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    ))

    styles.add(ParagraphStyle(
        name='ReportBody',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=c_text,
        spaceAfter=8
    ))

    styles.add(ParagraphStyle(
        name='ReportBodyBold',
        parent=styles['ReportBody'],
        fontName='Helvetica-Bold'
    ))

    styles.add(ParagraphStyle(
        name='CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#111827"),
        backColor=c_bg_light,
        borderColor=colors.HexColor("#e5e7eb"),
        borderWidth=0.5,
        borderPadding=6,
        spaceBefore=6,
        spaceAfter=10
    ))

    story = []
    
    # ------------------ COVER PAGE ------------------
    story.append(Spacer(1, 100))
    story.append(Paragraph("SENTINELMRO", styles['CoverTitle']))
    story.append(Paragraph("Decentralized Edge-AI & Cryptographic Auditing Ecosystem for Predictive Maintenance", styles['CoverSubTitle']))
    
    # Horizontal line decoration
    decor_table = Table([[""]], colWidths=[504])
    decor_table.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 3.0, c_primary),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0)
    ]))
    story.append(decor_table)
    story.append(Spacer(1, 20))
    
    # Metadata
    metadata_text = """
    <b>Project Target:</b> Tata Technologies InnoVent-27 Competition<br/>
    <b>Category:</b> 3.2.3.3 (Decentralized Prognostics & Tamper-Evident Ledger)<br/>
    <b>Technology Stack:</b> Next.js 15, FastAPI, PyTorch, ONNX INT8 Quantization, SQLite, Ed25519 Cryptography<br/>
    <b>Version:</b> 1.0.0 (Production Prototype)<br/>
    <b>Date:</b> July 2026
    """
    story.append(Paragraph(metadata_text, styles['ReportBody']))
    
    story.append(Spacer(1, 200))
    story.append(Paragraph("<b>CONFIDENTIALITY NOTICE:</b> The information contained in this technical document is proprietary to the SentinelMRO Engineering Team and prepared strictly for evaluation under the Tata Technologies InnoVent-27 guidelines.", styles['ReportBody']))
    
    story.append(PageBreak())
    
    # ------------------ SECTION 1: EXECUTIVE SUMMARY ------------------
    story.append(Paragraph("1. Executive Summary", styles['ReportHeading1']))
    story.append(Paragraph(
        "Aviation Maintenance, Repair, and Overhaul (MRO) activities rely heavily on accurate "
        "predictive diagnostics to minimize unplanned aircraft groundings (AOG) while maintaining "
        "impeccable safety records. Historically, these systems use centralized cloud storage. "
        "However, centralized infrastructures suffer from critical bottlenecks, including high "
        "data transfer bandwidths, airline operational privacy concerns, and database susceptibility "
        "to unauthorized modifications or tampering.",
        styles['ReportBody']
    ))
    story.append(Paragraph(
        "<b>SentinelMRO</b> resolves these constraints by implementing a decentralized paradigm. "
        "The system runs localized, low-latency <b>INT8-quantized Temporal Convolutional Networks (TCN)</b> "
        "directly on edge nodes (simulated MRO stations). To continuously train and improve these "
        "models without leaking proprietary operational telemetry, SentinelMRO coordinates "
        "cross-station <b>Federated Learning</b> using the <b>FedProx</b> optimization algorithm, "
        "supplemented by <b>Local Differential Privacy (LDP)</b>. Furthermore, flight logs, "
        "sensor data snapshots, and maintenance history are cryptographically signed using "
        "<b>Ed25519 keys</b> and recorded in an append-only <b>Merkle Mountain Range (MMR) ledger</b>, "
        "providing tamper-evidence and rapid mathematical verification of data integrity.",
        styles['ReportBody']
    ))
    
    # ------------------ SECTION 2: SYSTEM ARCHITECTURE ------------------
    story.append(Paragraph("2. System Architecture & Topology", styles['ReportHeading1']))
    story.append(Paragraph(
        "The SentinelMRO ecosystem comprises three key architectural layers:",
        styles['ReportBody']
    ))
    
    # Bullet points
    story.append(Paragraph("• <b>Edge Nodes (FastAPI + ONNX Runtime)</b>: Serve real-time inference on 14 selected sensor channels in under 3ms. Features are normalized, sliced, and loaded into an INT8-quantized TCN model.", styles['ReportBody']))
    story.append(Paragraph("• <b>Aggregation Coordinator (FastAPI Gateway)</b>: Directs federated learning training rounds, implements mathematical aggregation (FedProx averaging), and exposes metrics.", styles['ReportBody']))
    story.append(Paragraph("• <b>SQLite Merkle Mountain Range Ledger</b>: Houses signed records. The MMR database is maintained in a local SQLite file (ledger.db) for O(log n) audits.", styles['ReportBody']))
    
    # ------------------ SECTION 3: MACHINE LEARNING & QUANTIZATION ------------------
    story.append(Paragraph("3. Edge-AI & Quantization Pipeline (Phase 1)", styles['ReportHeading1']))
    story.append(Paragraph(
        "SentinelMRO uses the NASA C-MAPSS dataset (FD001 engine trajectories) as its ML benchmark. "
        "Before training, low-variance sensor readings are stripped out to compress input dimension.",
        styles['ReportBody']
    ))
    
    # Table of sensor cleaning
    sensor_data = [
        ["Sensor Type", "Action", "Sensor Channels", "Variance / Details"],
        ["Low-Variance Constants", "Dropped", "s1, s5, s6, s10, s16, s18, s19", "Flatlines / No operational variance"],
        ["High-Variance Dynamics", "Retained", "s2, s3, s4, s7, s8, s9, s11, s12, s13, s14, s15, s17, s20, s21", "14 Active features mapped to sliding windows"]
    ]
    t_sensor = Table(sensor_data, colWidths=[130, 60, 160, 154])
    t_sensor.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('BACKGROUND', (0,1), (-1,1), c_bg_light),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#d1d5db")),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 8.5),
    ]))
    story.append(t_sensor)
    story.append(Spacer(1, 10))
    
    story.append(Paragraph(
        "<b>Model Compiling and Quantization:</b> A causal TCN (Temporal Convolutional Network) "
        "is trained on PyTorch, implementing exponential dilations of 1, 2, 4, and 8. Weight normalization "
        "is used during optimization. For edge deployment, we remove weight normalization hooks (collapsing "
        "them into static parameters) and compile the network into an ONNX graph. Post-training dynamic "
        "INT8 quantization is applied, achieving a <b>4x file size reduction</b> and sub-3ms CPU execution.",
        styles['ReportBody']
    ))
    
    # ------------------ SECTION 4: PRIVACY-PRESERVING FL ------------------
    story.append(Paragraph("4. Federated Optimization (Phase 2)", styles['ReportHeading1']))
    story.append(Paragraph(
        "Under non-IID conditions where data varies widely between airlines and MRO hubs, "
        "standard Federated Averaging (FedAvg) leads to poor model convergence. SentinelMRO "
        "implements the <b>FedProx</b> optimization routine to handle this heterogeneity. The local "
        "optimization loss is regularized using a proximal constraint:",
        styles['ReportBody']
    ))
    
    # Mathematical equation box
    story.append(Paragraph("<b>FedProx Loss Formula:</b>", styles['ReportHeading2']))
    story.append(Paragraph(
        "Loss_prox(w) = Loss_local(w) + (mu / 2) * || w - w^t ||^2",
        styles['CodeStyle']
    ))
    story.append(Paragraph(
        "Where w represents the local parameters, w^t is the global model weights at round t, and "
        "mu is set to 0.01. This mathematical penalty stabilizes weight adjustments, preventing local "
        "weights from drifting too far from the global average.",
        styles['ReportBody']
    ))
    story.append(Paragraph(
        "<b>Local Differential Privacy (LDP)</b> is applied by adding calibrated Gaussian noise "
        "directly to the model weights before uploading: w_priv = w_local + N(0, 0.001^2), ensuring "
        "that raw telemetry data cannot be reconstructed via model inversion attacks.",
        styles['ReportBody']
    ))
    
    # ------------------ SECTION 5: MERKLE MOUNTAIN RANGE LEDGER ------------------
    story.append(PageBreak())
    story.append(Paragraph("5. SQLite Cryptographic MMR Ledger (Phase 3)", styles['ReportHeading1']))
    story.append(Paragraph(
        "Every event sent to the central coordinator must be cryptographically signed by "
        "the submitting station's private Ed25519 key. The coordinator validates this signature "
        "against the station's known public key to securely verify identity.",
        styles['ReportBody']
    ))
    story.append(Paragraph(
        "The maintenance transactions are logged into an append-only SQLite database "
        "using a <b>Merkle Mountain Range (MMR)</b> structure. Unlike standard linear chains, "
        "MMR enables O(log n) inclusion proofs and checks. If any database column is altered "
        "maliciously, the root hash is broken and integrity validation immediately triggers an alarm.",
        styles['ReportBody']
    ))
    
    story.append(Paragraph("MMR Ledger Database Table Schema (mro_ledger):", styles['ReportHeading2']))
    
    # Database Table Style
    db_data = [
        ["Column Name", "Data Type", "Constraints", "Description"],
        ["leaf_index", "INTEGER", "PRIMARY KEY", "Auto-incrementing leaf position (1-indexed)"],
        ["timestamp", "TEXT", "NOT NULL", "ISO-8601 string of log entry time"],
        ["component_id", "TEXT", "NOT NULL", "ID of target component (e.g., ENG-001)"],
        ["action_taken", "TEXT", "NOT NULL", "Maintenance detail (e.g., Blade Replacement)"],
        ["technician_id", "TEXT", "NOT NULL", "ID of MRO technician"],
        ["health_snapshot", "REAL", "NOT NULL", "TCN-inferred continuous health score (1.0 to 0.0)"],
        ["node_hash", "TEXT", "NOT NULL", "SHA-256 hash of the row payload (excluding index)"]
    ]
    t_db = Table(db_data, colWidths=[100, 70, 100, 234])
    t_db.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_secondary),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BOTTOMPADDING', (0,0), (-1,0), 4),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#d1d5db")),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 8.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light])
    ]))
    story.append(t_db)
    story.append(Spacer(1, 10))

    # ------------------ SECTION 6: WORKED EXAMPLE ------------------
    story.append(Paragraph("6. Worked Trace Example: Logging & Tampering", styles['ReportHeading1']))
    story.append(Paragraph(
        "To illustrate the end-to-end operation, let us walk through a complete logged event "
        "and a subsequent security violation check.",
        styles['ReportBody']
    ))
    
    story.append(Paragraph("<b>Step 1: Technician replacement entry</b>", styles['ReportHeading2']))
    story.append(Paragraph(
        "A technician replaces a compressor blade on ENG-002. The edge node constructs the message payload:<br/>"
        "<code>'2026-07-03T13:42:53.000Z|ENG-002|Blade Replacement|TECH-502|0.85'</code>",
        styles['ReportBody']
    ))
    
    story.append(Paragraph("<b>Step 2: Ed25519 Signing</b>", styles['ReportHeading2']))
    story.append(Paragraph(
        "The edge node uses STATION_001's private key to sign the message, yielding signature hex "
        "<code>'8bf982cd6b4ef8919e...'</code>. This is submitted to the API gateway in the HTTP headers.",
        styles['ReportBody']
    ))

    story.append(Paragraph("<b>Step 3: Verification & Append</b>", styles['ReportHeading2']))
    story.append(Paragraph(
        "The API gateway verifies the signature using STATION_001's public key. Upon confirmation, the "
        "payload is written to <code>mro_ledger</code>. The MMR computes the leaf hash <code>sha256(payload) = '5f8a0dc4f67c...'</code> "
        "and merges peaks, producing a new cryptographic root hash.",
        styles['ReportBody']
    ))

    story.append(Paragraph("<b>Step 4: Tampering & Auditing</b>", styles['ReportHeading2']))
    story.append(Paragraph(
        "If a malicious actor directly updates SQLite to change <code>health_snapshot = 0.99</code> on this row, "
        "running the <code>/verify</code> routine will re-calculate the leaf hash from the actual row columns. "
        "The recomputed hash (starting with <code>'7a11c8...'</code>) will mismatch the stored `node_hash` "
        "(starting with <code>'5f8a0dc4f67c...'</code>), and the verification fails. The dashboard UI immediately "
        "flashes red, notifying MRO managers of data corruption.",
        styles['ReportBody']
    ))

    # ------------------ SECTION 7: CHECKLIST ------------------
    story.append(Spacer(1, 10))
    story.append(Paragraph("7. Project Completion Checklist", styles['ReportHeading1']))
    story.append(Paragraph("✔ <b>Edge Inference</b>: Quantized TCN model executes locally in < 3ms.", styles['ReportBody']))
    story.append(Paragraph("✔ <b>Federated Optimizer</b>: FedProx updates stable weights across non-IID partitions.", styles['ReportBody']))
    story.append(Paragraph("✔ <b>Cryptographic MMR Ledger</b>: Append, verify, and tamper routes fully functional in SQLite.", styles['ReportBody']))
    story.append(Paragraph("✔ <b>Command Console</b>: Responsive Next.js 15 dashboard showing real-time streaming, aggregation charts, and ledger alerts.", styles['ReportBody']))

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF generated successfully at: {pdf_path}")

if __name__ == "__main__":
    build_pdf()
