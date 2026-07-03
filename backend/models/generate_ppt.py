import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

def apply_background(slide, color):
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = color

def create_textbox(slide, left, top, width, height, margin=0):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(margin)
    tf.margin_right = Inches(margin)
    tf.margin_top = Inches(margin)
    tf.margin_bottom = Inches(margin)
    return tf

def add_slide_header(slide, title_text, category_text="SentinelMRO Core Subsystem"):
    # Dark Header bar decoration
    header_box = slide.shapes.add_shape(
        1, # Rectangle
        Inches(0), Inches(0), Inches(10), Inches(1)
    )
    header_box.fill.solid()
    header_box.fill.fore_color.rgb = RGBColor(17, 24, 39) # Deep gray
    header_box.line.color.rgb = RGBColor(99, 102, 241) # Indigo border
    header_box.line.width = Pt(1.5)

    # Title text
    tf = create_textbox(slide, Inches(0.5), Inches(0.15), Inches(6.5), Inches(0.7))
    p = tf.paragraphs[0]
    p.text = title_text
    p.font.name = 'Arial'
    p.font.size = Pt(22)
    p.font.bold = True
    p.font.color.rgb = RGBColor(255, 255, 255)

    # Category text
    tf_c = create_textbox(slide, Inches(7.0), Inches(0.3), Inches(2.5), Inches(0.4))
    p_c = tf_c.paragraphs[0]
    p_c.alignment = PP_ALIGN.RIGHT
    p_c.text = category_text
    p_c.font.name = 'Arial'
    p_c.font.size = Pt(10)
    p_c.font.color.rgb = RGBColor(129, 140, 248) # Indigo accent
    p_c.font.bold = True

def add_bullet_point(tf, title, body, bold_title=True):
    p = tf.add_paragraph()
    p.space_after = Pt(8)
    
    if bold_title:
        run_title = p.add_run()
        run_title.text = "• " + title + ": "
        run_title.font.bold = True
        run_title.font.size = Pt(13)
        run_title.font.name = 'Arial'
        run_title.font.color.rgb = RGBColor(255, 255, 255)
    else:
        run_title = p.add_run()
        run_title.text = "• " + title
        run_title.font.size = Pt(13)
        run_title.font.name = 'Arial'
        run_title.font.color.rgb = RGBColor(255, 255, 255)

    run_body = p.add_run()
    run_body.text = body
    run_body.font.size = Pt(12)
    run_body.font.name = 'Arial'
    run_body.font.color.rgb = RGBColor(209, 213, 219) # Light gray

def build_presentation():
    prs = Presentation()
    
    # Set to widescreen 16:9
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(5.625)
    
    blank_layout = prs.slide_layouts[6]
    
    # Palette
    c_bg = RGBColor(10, 10, 12)       # Dark background
    c_indigo = RGBColor(99, 102, 241) # Indigo accent
    c_teal = RGBColor(20, 184, 166)   # Teal accent
    
    # ==================== SLIDE 1: TITLE SLIDE ====================
    slide1 = prs.slides.add_slide(blank_layout)
    apply_background(slide1, c_bg)
    
    # Add title decorative rectangle
    accent_box = slide1.shapes.add_shape(
        1, Inches(0.5), Inches(1.5), Inches(0.1), Inches(2.2)
    )
    accent_box.fill.solid()
    accent_box.fill.fore_color.rgb = c_indigo
    accent_box.line.fill.background()

    tf1 = create_textbox(slide1, Inches(0.8), Inches(1.4), Inches(8.5), Inches(1.2))
    p_title = tf1.paragraphs[0]
    p_title.text = "SENTINELMRO"
    p_title.font.size = Pt(44)
    p_title.font.bold = True
    p_title.font.name = 'Arial'
    p_title.font.color.rgb = RGBColor(255, 255, 255)
    
    p_sub = tf1.add_paragraph()
    p_sub.text = "Decentralized Edge-AI Diagnostics & Immutable Cryptographic Audit Ledger"
    p_sub.font.size = Pt(16)
    p_sub.font.name = 'Arial'
    p_sub.font.color.rgb = c_teal
    p_sub.space_before = Pt(8)
    
    # Bottom metadata
    tf_meta = create_textbox(slide1, Inches(0.8), Inches(3.8), Inches(8.0), Inches(1.2))
    p_m1 = tf_meta.paragraphs[0]
    p_m1.text = "Prepared for the Tata Technologies InnoVent-27 Competition (Category 3.2.3.3)"
    p_m1.font.size = Pt(11)
    p_m1.font.bold = True
    p_m1.font.color.rgb = RGBColor(156, 163, 175)
    
    p_m2 = tf_meta.add_paragraph()
    p_m2.text = "Backend: Python, PyTorch, ONNX INT8 Quantization, SQLite | Frontend: Next.js 15 App Router"
    p_m2.font.size = Pt(9.5)
    p_m2.font.color.rgb = RGBColor(107, 114, 128)
    p_m2.space_before = Pt(4)

    # ==================== SLIDE 2: THE PROBLEM STATEMENT ====================
    slide2 = prs.slides.add_slide(blank_layout)
    apply_background(slide2, c_bg)
    add_slide_header(slide2, "The Problem: Centralized Cloud PHM Deficiencies", "Context & Industry Pain Points")
    
    # Two Columns layout
    tf_col1 = create_textbox(slide2, Inches(0.5), Inches(1.3), Inches(4.3), Inches(3.8))
    p_h1 = tf_col1.paragraphs[0]
    p_h1.text = "Legacy Architecture Bottlenecks"
    p_h1.font.size = Pt(15)
    p_h1.font.bold = True
    p_h1.font.color.rgb = c_teal
    p_h1.space_after = Pt(10)
    
    add_bullet_point(tf_col1, "Bandwidth & Latency", "Uploading gigabytes of high-frequency sensor telemetry to clouds causes latency and increases network overhead.")
    add_bullet_point(tf_col1, "Proprietary Data Leakage", "Airlines are highly protective of engine metrics; central uploading raises severe data security concerns.")

    tf_col2 = create_textbox(slide2, Inches(5.2), Inches(1.3), Inches(4.3), Inches(3.8))
    p_h2 = tf_col2.paragraphs[0]
    p_h2.text = "Audit & Database Vulnerabilities"
    p_h2.font.size = Pt(15)
    p_h2.font.bold = True
    p_h2.font.color.rgb = c_teal
    p_h2.space_after = Pt(10)
    
    add_bullet_point(tf_col2, "Retroactive Manipulation", "Standard maintenance logs stored in centralized databases lack cryptographic seals, risking unauthorized tampering.")
    add_bullet_point(tf_col2, "Non-IID Divergence", "Operating profiles vary across MRO stations. Centralized models become biased toward nominal or high-use fleets.")

    # ==================== SLIDE 3: THE DECENTRALIZED SOLUTION ====================
    slide3 = prs.slides.add_slide(blank_layout)
    apply_background(slide3, c_bg)
    add_slide_header(slide3, "The Solution: SentinelMRO Architecture", "Subsystem Overview")
    
    # 3 Column layout
    widths = [Inches(2.8), Inches(2.8), Inches(2.8)]
    lefts = [Inches(0.5), Inches(3.6), Inches(6.7)]
    
    titles = [
        "1. Edge-AI Diagnostics",
        "2. Privacy Federated Learning",
        "3. Cryptographic MMR Ledger"
    ]
    
    contents = [
        "Preprocesses 14 sensor channels and regresses RUL on an INT8-quantized TCN model in under 3 milliseconds.",
        "Executes cross-station FedProx local updates and aggregates gradients with Local Differential Privacy (LDP) perturbations.",
        "Validates Ed25519 edge signatures and logs events to an append-only Merkle Mountain Range database in SQLite."
    ]
    
    for i in range(3):
        # Card background
        card = slide3.shapes.add_shape(
            1, lefts[i], Inches(1.4), widths[i], Inches(3.6)
        )
        card.fill.solid()
        card.fill.fore_color.rgb = RGBColor(17, 24, 39)
        card.line.color.rgb = c_indigo
        card.line.width = Pt(1.0)
        
        tf_card = card.text_frame
        tf_card.word_wrap = True
        tf_card.margin_left = Inches(0.15)
        tf_card.margin_right = Inches(0.15)
        tf_card.margin_top = Inches(0.15)
        
        p = tf_card.paragraphs[0]
        p.text = titles[i]
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = c_teal
        p.space_after = Pt(10)
        
        p_c = tf_card.add_paragraph()
        p_c.text = contents[i]
        p_c.font.size = Pt(11)
        p_c.font.color.rgb = RGBColor(209, 213, 219)

    # ==================== SLIDE 4: PHASE 1 EDGE INFERENCE ====================
    slide4 = prs.slides.add_slide(blank_layout)
    apply_background(slide4, c_bg)
    add_slide_header(slide4, "Phase 1: Quantized Causal TCN Engine", "Edge Inference")
    
    tf_col = create_textbox(slide4, Inches(0.5), Inches(1.3), Inches(9.0), Inches(3.8))
    
    add_bullet_point(tf_col, "Data Sanitization", "Strips out 7 zero-variance constant sensor channels. Fits localized MinMaxScaler within a strict [0, 1] bounds.")
    add_bullet_point(tf_col, "Temporal Convolutional Network", "Replaces slow LSTMs. Utilizes exponential dilations (1, 2, 4, 8) with kernel size k=3. Parallel causal convolutions ensure O(1) latency.")
    add_bullet_point(tf_col, "Dynamic INT8 Quantization", "Removes training weight normalization hooks (remove_weight_norm). Quantizes ONNX weights dynamically, reducing footprint and allowing CPU execution in < 3ms.")

    # ==================== SLIDE 5: PHASE 2 FEDERATED LEARNING ====================
    slide5 = prs.slides.add_slide(blank_layout)
    apply_background(slide5, c_bg)
    add_slide_header(slide5, "Phase 2: FedProx & LDP Collaborative Learning", "Federated Optimization")
    
    tf_col = create_textbox(slide5, Inches(0.5), Inches(1.3), Inches(9.0), Inches(3.8))
    
    add_bullet_point(tf_col, "Non-IID Partitioning", "Splits the NASA dataset into 3 operational clusters simulating different MRO hubs: Nominal (ST-1), High-stress (ST-2), and Mixed (ST-3).")
    add_bullet_point(tf_col, "FedProx Regularization", "Appends a proximal regularization penalty to local loss loops: (mu / 2) * || w - w^t ||^2. Solves data distribution mismatch and stabilizes local weight adjustments.")
    add_bullet_point(tf_col, "Local Differential Privacy", "Injects calibrated Gaussian noise w_priv = w_local + N(0, 0.001^2) to parameters before gateway aggregation to protect client telemetry.")

    # ==================== SLIDE 6: PHASE 3 CRYPTOGRAPHIC LEDGER ====================
    slide6 = prs.slides.add_slide(blank_layout)
    apply_background(slide6, c_bg)
    add_slide_header(slide6, "Phase 3: Cryptographic SQLite MMR Ledger", "Audit & Security")
    
    tf_col = create_textbox(slide6, Inches(0.5), Inches(1.3), Inches(9.0), Inches(3.8))
    
    add_bullet_point(tf_col, "Ed25519 Payload Signing", "Transactions generated at MRO edge nodes must include a signature. Verified at the gateway using station public keys, preventing spoofing.")
    add_bullet_point(tf_col, "Merkle Mountain Range (MMR)", "Appends nodes to a binary tree in post-order flat indexing. Enables O(log n) inclusion proofs and rapid integrity verification checks.")
    add_bullet_point(tf_col, "Tamper Detection Backdoor", "Updates SQLite columns directly without re-building peaks or leaf hashes. Integrity check fails instantly on root hash mismatch, highlighting altered rows.")

    # ==================== SLIDE 7: PHASE 4 COMMAND DASHBOARD ====================
    slide7 = prs.slides.add_slide(blank_layout)
    apply_background(slide7, c_bg)
    add_slide_header(slide7, "Phase 4: Next.js 15 Command Console", "User Interface & Control")
    
    tf_col = create_textbox(slide7, Inches(0.5), Inches(1.3), Inches(9.0), Inches(3.8))
    
    add_bullet_point(tf_col, "Premium Dark Industrial Theme", "Built on bg-zinc-950 and text-zinc-50 with responsive, sleek glassmorphism panels.")
    add_bullet_point(tf_col, "Real-time Telemetry plots", "Integrates interactive Recharts line curves linking predicted TCN RUL with high-frequency core speed and bypass ratio trends.")
    add_bullet_point(tf_col, "Interactive Security Console", "Features buttons to Verify Ecosystem Integrity or Simulate Malicious Database Injection. Alerts flash red dynamically on tampering validation mismatch.")

    # ==================== SLIDE 8: WORKED TRACE EXAMPLE ====================
    slide8 = prs.slides.add_slide(blank_layout)
    apply_background(slide8, c_bg)
    add_slide_header(slide8, "Worked Trace Example: Maintenance Logging", "Ecosystem in Action")
    
    # Left Box
    tf_left = create_textbox(slide8, Inches(0.5), Inches(1.3), Inches(4.3), Inches(3.8))
    p_step1 = tf_left.paragraphs[0]
    p_step1.text = "Step 1: Construct & Sign Payload"
    p_step1.font.size = Pt(14)
    p_step1.font.bold = True
    p_step1.font.color.rgb = c_teal
    p_step1.space_after = Pt(6)
    p_step1.space_before = Pt(6)
    
    p_left_body = tf_left.add_paragraph()
    p_left_body.text = (
        "- Payload: Timestamp|Component_ID|Action|Tech_ID|Health\n"
        "- Station_001 signs using private Ed25519 key\n"
        "- Payload and Signature posted to /append endpoint"
    )
    p_left_body.font.size = Pt(11)
    p_left_body.font.color.rgb = RGBColor(209, 213, 219)
    p_left_body.space_before = Pt(4)
    
    p_step2 = tf_left.add_paragraph()
    p_step2.text = "Step 2: Gateway Verify & Log"
    p_step2.font.size = Pt(14)
    p_step2.font.bold = True
    p_step2.font.color.rgb = c_teal
    p_step2.space_before = Pt(10)
    p_step2.space_after = Pt(6)

    p_left_body2 = tf_left.add_paragraph()
    p_left_body2.text = (
        "- Gateway checks signature with public key\n"
        "- Inserts row into SQLite mro_ledger\n"
        "- Recomputes MMR leaf hash and merges peaks"
    )
    p_left_body2.font.size = Pt(11)
    p_left_body2.font.color.rgb = RGBColor(209, 213, 219)

    # Right Box
    tf_right = create_textbox(slide8, Inches(5.2), Inches(1.3), Inches(4.3), Inches(3.8))
    p_step3 = tf_right.paragraphs[0]
    p_step3.text = "Step 3: Tampering Simulation"
    p_step3.font.size = Pt(14)
    p_step3.font.bold = True
    p_step3.font.color.rgb = c_teal
    p_step3.space_after = Pt(6)
    p_step3.space_before = Pt(6)
    
    p_right_body = tf_right.add_paragraph()
    p_right_body.text = (
        "- Intruder updates SQLite table directly\n"
        "- Leaf 1 component_id altered to 'TAMPERED-ENG'\n"
        "- Node hash & MMR nodes left unchanged"
    )
    p_right_body.font.size = Pt(11)
    p_right_body.font.color.rgb = RGBColor(209, 213, 219)
    p_right_body.space_before = Pt(4)
    
    p_step4 = tf_right.add_paragraph()
    p_step4.text = "Step 4: Audit Verification Alert"
    p_step4.font.size = Pt(14)
    p_step4.font.bold = True
    p_step4.font.color.rgb = c_teal
    p_step4.space_before = Pt(10)
    p_step4.space_after = Pt(6)

    p_right_body2 = tf_right.add_paragraph()
    p_right_body2.text = (
        "- Auditor re-computes Leaf 1 hash from raw columns\n"
        "- Recomputed hash mismatches stored node_hash\n"
        "- System identifies altered leaf index & logs alert"
    )
    p_right_body2.font.size = Pt(11)
    p_right_body2.font.color.rgb = RGBColor(209, 213, 219)

    # ==================== SLIDE 9: STATUS & checklist ====================
    slide9 = prs.slides.add_slide(blank_layout)
    apply_background(slide9, c_bg)
    add_slide_header(slide9, "Conclusion: SentinelMRO InnoVent-27 Ready", "Competitive Summary")
    
    tf_col = create_textbox(slide9, Inches(0.5), Inches(1.3), Inches(9.0), Inches(3.8))
    
    add_bullet_point(tf_col, "Edge-AI Latency", "Model compiled and quantized dynamically, performing edge prediction on CPU in under 3ms.")
    add_bullet_point(tf_col, "Federated Optimizers", "FedProx regularizer penalty and LDP noise aggregation fully operational.")
    add_bullet_point(tf_col, "Audit Integrity", "SQLite-backed MMR append, verify, and backdoor tampering functions fully complete.")
    add_bullet_point(tf_col, "Command Console", "Next.js 15 dashboard offers high-fidelity visual control room, ready for live presentation.")

    # Save
    ppt_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "documentation"))
    os.makedirs(ppt_dir, exist_ok=True)
    ppt_path = os.path.join(ppt_dir, "SentinelMRO_Project_Presentation.pptx")
    prs.save(ppt_path)
    print(f"Presentation saved successfully at: {ppt_path}")

if __name__ == "__main__":
    build_presentation()
