Add-Type -AssemblyName System.Drawing

function Create-PhoneFrame($g, $title, $subtitle) {
    $headerBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point(1080, 260)),
        [System.Drawing.ColorTranslator]::FromHtml("#7b0000"),
        [System.Drawing.ColorTranslator]::FromHtml("#4a0000")
    )
    $g.FillRectangle($headerBrush, 0, 0, 1080, 260)
    
    $titleFont = New-Object System.Drawing.Font("Arial", 30, [System.Drawing.FontStyle]::Bold)
    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#FFD700"))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString($title, $titleFont, $titleBrush, 540, 70, $sf)
    
    $subFont = New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Regular)
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.DrawString($subtitle, $subFont, $subBrush, 540, 140, $sf)
    
    $goldPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#FFD700"), 4)
    $g.DrawLine($goldPen, 0, 258, 1080, 258)
}

$sfCenter = New-Object System.Drawing.StringFormat
$sfCenter.Alignment = [System.Drawing.StringAlignment]::Center

$cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$cardPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#E0E0E0"), 2)
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#F5F5F7"))
$maroonBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#7b0000"))
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$grayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#666666"))
$darkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#333333"))

# ==========================================
# SCREENSHOT 1: PORTAL & AUTHENTICATION
# ==========================================
$bmp1 = New-Object System.Drawing.Bitmap(1080, 1920)
$g1 = [System.Drawing.Graphics]::FromImage($bmp1)
$g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g1.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g1.FillRectangle($bgBrush, 0, 0, 1080, 1920)

Create-PhoneFrame $g1 "NERMAI IAS ACADEMY" "CIVIL SERVICES LEARNING AND EXAMINATION PORTAL"

$g1.FillRectangle($cardBrush, 90, 340, 900, 1420)
$g1.DrawRectangle($cardPen, 90, 340, 900, 1420)

$logoSrcPath = "d:\unistrix\NERMAI_IAS_ACADEMY\web_portal\assets\logo.png"
if (Test-Path $logoSrcPath) {
    $logoImg = [System.Drawing.Image]::FromFile($logoSrcPath)
    $g1.DrawImage($logoImg, 430, 380, 220, 230)
    $logoImg.Dispose()
}

$bold22 = New-Object System.Drawing.Font("Arial", 22, [System.Drawing.FontStyle]::Bold)
$g1.DrawString("NERMAI IAS ACADEMY", $bold22, $maroonBrush, 540, 650, $sfCenter)

$reg15 = New-Object System.Drawing.Font("Arial", 15, [System.Drawing.FontStyle]::Regular)
$g1.DrawString("Empowering Aspirants for UPSC and TNPSC Success", $reg15, $grayBrush, 540, 700, $sfCenter)

# Google Login Button
$googleBtnBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#4285F4"))
$g1.FillRectangle($googleBtnBrush, 160, 770, 760, 90)
$whiteFont = New-Object System.Drawing.Font("Arial", 18, [System.Drawing.FontStyle]::Bold)
$g1.DrawString("Continue with Google (Guest Access)", $whiteFont, $whiteBrush, 540, 800, $sfCenter)

# Divider
$g1.DrawLine($cardPen, 160, 910, 920, 910)
$g1.DrawString("OR REGISTERED STUDENT SIGN IN", (New-Object System.Drawing.Font("Arial", 12, [System.Drawing.FontStyle]::Bold)), $grayBrush, 540, 898, $sfCenter)

# Input Boxes
$inputBg = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#F8F9FA"))
$inputPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#D0D5DD"), 2)

$g1.FillRectangle($inputBg, 160, 960, 760, 80)
$g1.DrawRectangle($inputPen, 160, 960, 760, 80)
$g1.DrawString("Roll Number / Username", (New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Regular)), $grayBrush, 190, 988)

$g1.FillRectangle($inputBg, 160, 1070, 760, 80)
$g1.DrawRectangle($inputPen, 160, 1070, 760, 80)
$g1.DrawString("Password", (New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Regular)), $grayBrush, 190, 1098)

# Log In Button
$loginBtnBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#1565C0"))
$g1.FillRectangle($loginBtnBrush, 160, 1190, 760, 90)
$g1.DrawString("LOG IN TO STUDENT PORTAL", $whiteFont, $whiteBrush, 540, 1220, $sfCenter)

# Highlights Box
$boxBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#FFF8E1"))
$boxPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#FFE082"), 2)
$g1.FillRectangle($boxBrush, 160, 1330, 760, 360)
$g1.DrawRectangle($boxPen, 160, 1330, 760, 360)

$g1.DrawString("Academy Features Included:", (New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Bold)), $maroonBrush, 190, 1360)
$itemFont = New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Regular)
$g1.DrawString("- Scheduled Full-Length and Sectional Mock Exams", $itemFont, $darkBrush, 210, 1410)
$g1.DrawString("- Real-Time Timer and Performance Evaluation", $itemFont, $darkBrush, 210, 1460)
$g1.DrawString("- Comprehensive UPSC and TNPSC Study Modules", $itemFont, $darkBrush, 210, 1510)
$g1.DrawString("- Batch Announcements, Attendance and Hall Tickets", $itemFont, $darkBrush, 210, 1560)
$g1.DrawString("- Daily Current Affairs and Exam Notifications", $itemFont, $darkBrush, 210, 1610)

$bmp1.Save("d:\unistrix\NERMAI_IAS_ACADEMY\playstore_screenshot_1.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g1.Dispose()
$bmp1.Dispose()
Write-Host "Created Screenshot 1"

# ==========================================
# SCREENSHOT 2: EXAM INTERFACE
# ==========================================
$bmp2 = New-Object System.Drawing.Bitmap(1080, 1920)
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g2.FillRectangle($bgBrush, 0, 0, 1080, 1920)

Create-PhoneFrame $g2 "ONLINE EXAMINATION PORTAL" "REAL-TIME UPSC AND TNPSC MOCK TESTS"

# Exam Header Card
$g2.FillRectangle($cardBrush, 60, 300, 960, 150)
$g2.DrawRectangle($cardPen, 60, 300, 960, 150)
$g2.DrawString("UPSC Civil Services Prelims Mock Test - GS Paper I", (New-Object System.Drawing.Font("Arial", 18, [System.Drawing.FontStyle]::Bold)), $darkBrush, 90, 330)
$g2.DrawString("Total Questions: 100  |  Marks: 200", (New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Regular)), $grayBrush, 90, 380)

# Timer Badge
$timerBg = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#E8F5E9"))
$timerPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#81C784"), 2)
$g2.FillRectangle($timerBg, 740, 330, 240, 80)
$g2.DrawRectangle($timerPen, 740, 330, 240, 80)
$greenBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#2E7D32"))
$g2.DrawString("TIME: 01:45:22", (New-Object System.Drawing.Font("Arial", 15, [System.Drawing.FontStyle]::Bold)), $greenBrush, 765, 358)

# Question Card
$g2.FillRectangle($cardBrush, 60, 480, 960, 860)
$g2.DrawRectangle($cardPen, 60, 480, 960, 860)

$qNumBadge = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#7b0000"))
$g2.FillRectangle($qNumBadge, 90, 510, 180, 50)
$g2.DrawString("Question 14", (New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Bold)), $whiteBrush, 120, 523)

$qFont = New-Object System.Drawing.Font("Arial", 17, [System.Drawing.FontStyle]::Bold)
$qText = "With reference to the Constitution of India, which one of the following rights is guaranteed under Article 21?"
$g2.DrawString($qText, $qFont, $darkBrush, (New-Object System.Drawing.RectangleF(90, 580, 900, 140)))

$optBg = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#FAFAFA"))
$optSelectedBg = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#E3F2FD"))
$optSelectedPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#2196F3"), 2)

$options = @(
    "A) Right to freedom of speech and expression",
    "B) Right to protection of life and personal liberty",
    "C) Right against exploitation",
    "D) Right to freedom of conscience and religion"
)

for ($i = 0; $i -lt 4; $i++) {
    $optY = 720 + ($i * 120)
    if ($i -eq 1) {
        $g2.FillRectangle($optSelectedBg, 90, $optY, 900, 95)
        $g2.DrawRectangle($optSelectedPen, 90, $optY, 900, 95)
        $g2.DrawString($options[$i], (New-Object System.Drawing.Font("Arial", 15, [System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#1565C0"))), 120, $optY + 32)
    } else {
        $g2.FillRectangle($optBg, 90, $optY, 900, 95)
        $g2.DrawRectangle($cardPen, 90, $optY, 900, 95)
        $g2.DrawString($options[$i], (New-Object System.Drawing.Font("Arial", 15, [System.Drawing.FontStyle]::Regular)), $darkBrush, 120, $optY + 32)
    }
}

# Bottom Action Buttons
$prevBtn = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#ECEFF1"))
$g2.FillRectangle($prevBtn, 60, 1370, 260, 80)
$g2.DrawString("PREVIOUS", (New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Bold)), $darkBrush, 120, 1398)

$saveBtn = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#2E7D32"))
$g2.FillRectangle($saveBtn, 340, 1370, 400, 80)
$g2.DrawString("SAVE AND NEXT", (New-Object System.Drawing.Font("Arial", 15, [System.Drawing.FontStyle]::Bold)), $whiteBrush, 460, 1398)

$submitBtn = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#C62828"))
$g2.FillRectangle($submitBtn, 760, 1370, 260, 80)
$g2.DrawString("SUBMIT TEST", (New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Bold)), $whiteBrush, 820, 1398)

# Palette Overview Box
$g2.FillRectangle($cardBrush, 60, 1480, 960, 380)
$g2.DrawRectangle($cardPen, 60, 1480, 960, 380)
$g2.DrawString("Question Navigation Palette (100 Questions):", (New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Bold)), $darkBrush, 90, 1505)

for ($r = 0; $r -lt 4; $r++) {
    for ($c = 0; $c -lt 10; $c++) {
        $num = ($r * 10) + $c + 1
        $bx = 90 + ($c * 90)
        $by = 1550 + ($r * 70)
        $bubbleBrush = if ($num -eq 14) { (New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#2196F3"))) } `
                       elseif ($num -lt 14) { (New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#4CAF50"))) } `
                       else { (New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#EEEEEE"))) }
        $g2.FillEllipse($bubbleBrush, $bx, $by, 50, 50)
        $bTextBrush = if ($num -le 14) { $whiteBrush } else { $darkBrush }
        $g2.DrawString($num.ToString(), (New-Object System.Drawing.Font("Arial", 11, [System.Drawing.FontStyle]::Bold)), $bTextBrush, $bx + 15, $by + 15)
    }
}

$bmp2.Save("d:\unistrix\NERMAI_IAS_ACADEMY\playstore_screenshot_2.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose()
$bmp2.Dispose()
Write-Host "Created Screenshot 2"

# ==========================================
# SCREENSHOT 3: COURSES AND DASHBOARD
# ==========================================
$bmp3 = New-Object System.Drawing.Bitmap(1080, 1920)
$g3 = [System.Drawing.Graphics]::FromImage($bmp3)
$g3.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g3.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g3.FillRectangle($bgBrush, 0, 0, 1080, 1920)

Create-PhoneFrame $g3 "COURSES AND STUDY MODULES" "COMPREHENSIVE SYLLABUS COVERAGE AND ANALYTICS"

# Card 1: UPSC
$g3.FillRectangle($cardBrush, 60, 300, 960, 300)
$g3.DrawRectangle($cardPen, 60, 300, 960, 300)
$badge1 = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#E8EAF6"))
$g3.FillRectangle($badge1, 90, 330, 220, 45)
$g3.DrawString("UPSC CIVIL SERVICES", (New-Object System.Drawing.Font("Arial", 11, [System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#283593"))), 105, 345)
$g3.DrawString("IAS / IPS Prelims cum Mains Complete Batch", (New-Object System.Drawing.Font("Arial", 18, [System.Drawing.FontStyle]::Bold)), $darkBrush, 90, 395)
$g3.DrawString("Full coverage of GS Papers 1 to 4, CSAT, Essay, and Current Affairs with regular mentor evaluation.", (New-Object System.Drawing.Font("Arial", 13, [System.Drawing.FontStyle]::Regular)), $grayBrush, (New-Object System.Drawing.RectangleF(90, 440, 880, 70)))
$enrollBtn = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#7b0000"))
$g3.FillRectangle($enrollBtn, 740, 520, 240, 60)
$g3.DrawString("View Details", (New-Object System.Drawing.Font("Arial", 13, [System.Drawing.FontStyle]::Bold)), $whiteBrush, 800, 540)

# Card 2: TNPSC
$g3.FillRectangle($cardBrush, 60, 630, 960, 300)
$g3.DrawRectangle($cardPen, 60, 630, 960, 300)
$badge2 = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#E0F2F1"))
$g3.FillRectangle($badge2, 90, 660, 220, 45)
$g3.DrawString("TNPSC GROUP I AND II", (New-Object System.Drawing.Font("Arial", 11, [System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#00695C"))), 105, 675)
$g3.DrawString("Comprehensive State Civil Services Exam Foundation", (New-Object System.Drawing.Font("Arial", 18, [System.Drawing.FontStyle]::Bold)), $darkBrush, 90, 725)
$g3.DrawString("In-depth focus on Tamil Nadu History, Culture, Heritage, Aptitude and General Studies syllabus.", (New-Object System.Drawing.Font("Arial", 13, [System.Drawing.FontStyle]::Regular)), $grayBrush, (New-Object System.Drawing.RectangleF(90, 770, 880, 70)))
$g3.FillRectangle($enrollBtn, 740, 850, 240, 60)
$g3.DrawString("View Details", (New-Object System.Drawing.Font("Arial", 13, [System.Drawing.FontStyle]::Bold)), $whiteBrush, 800, 870)

# Card 3: Dashboard Stats
$g3.FillRectangle($cardBrush, 60, 960, 960, 500)
$g3.DrawRectangle($cardPen, 60, 960, 960, 500)
$g3.DrawString("Student Dashboard and Performance Analytics", (New-Object System.Drawing.Font("Arial", 18, [System.Drawing.FontStyle]::Bold)), $maroonBrush, 90, 995)
$g3.DrawString("Instant access to official Academy Hall Tickets, Attendance percentages, and Batch-wise ranks.", (New-Object System.Drawing.Font("Arial", 13, [System.Drawing.FontStyle]::Regular)), $grayBrush, 90, 1045)

# Mini Stat Cards
$statBg = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#F5F5F5"))
$g3.FillRectangle($statBg, 90, 1100, 270, 140)
$g3.DrawString("Tests Attended", (New-Object System.Drawing.Font("Arial", 12, [System.Drawing.FontStyle]::Bold)), $grayBrush, 130, 1120)
$g3.DrawString("18", (New-Object System.Drawing.Font("Arial", 28, [System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#1565C0"))), 180, 1160)

$g3.FillRectangle($statBg, 400, 1100, 270, 140)
$g3.DrawString("Average Score", (New-Object System.Drawing.Font("Arial", 12, [System.Drawing.FontStyle]::Bold)), $grayBrush, 450, 1120)
$g3.DrawString("74.5%", (New-Object System.Drawing.Font("Arial", 28, [System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#2E7D32"))), 470, 1160)

$g3.FillRectangle($statBg, 710, 1100, 270, 140)
$g3.DrawString("Attendance", (New-Object System.Drawing.Font("Arial", 12, [System.Drawing.FontStyle]::Bold)), $grayBrush, 780, 1120)
$g3.DrawString("96%", (New-Object System.Drawing.Font("Arial", 28, [System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#E65100"))), 800, 1160)

# Notice Box
$noticeBg = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#FFF3E0"))
$g3.FillRectangle($noticeBg, 90, 1270, 890, 150)
$g3.DrawString("Latest Academy Announcement", (New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#E65100"))), 120, 1295)
$g3.DrawString("Upcoming All-India UPSC Prelims Mock Exam 3 will be activated this Sunday at 09:30 AM.", (New-Object System.Drawing.Font("Arial", 13, [System.Drawing.FontStyle]::Regular)), $darkBrush, 120, 1340)

$bmp3.Save("d:\unistrix\NERMAI_IAS_ACADEMY\playstore_screenshot_3.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g3.Dispose()
$bmp3.Dispose()
Write-Host "Created Screenshot 3"
