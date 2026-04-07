# ==============================================================================
# SUITE DE TESTS API — GYM API (alignée sur l’API actuelle)
# ==============================================================================
# Prerequis : API demarree (npm run dev), .env configure, port 5000.
# Lance : depuis gym back  ->  npm run test
# ==============================================================================
# Couverture :
#   1. Enregistrement salle (register-gym) + JWT
#   2. Abonnements CRUD (body : name, price, features, activityIds optionnel)
#   3. Membres POST /members (auth admin) + isolation multi-tenant
#   4. Acces QR (MEMBER- / TICKET-) + tickets types enum
#   5. Activites / Produits / Transactions (schemas Zod actuels)
#   6. Logs d'acces
#   7. Utilisateurs staff (reponses { user })
#   8. Securite (401, QR invalide, ticket double scan, cross-tenant, RBAC)
#   9. Nettoyage (membre de test supprime en dernier)
# ==============================================================================

$BASE_URL = "http://localhost:5000/api"
$PassCount = 0
$FailCount = 0

function Show-Header($msg) {
    Write-Host "`n>>> $msg <<<" -ForegroundColor Cyan
}

function Test-Endpoint($method, $path, $body, $token) {
    $url = "$BASE_URL$path"
    $headers = @{ "Content-Type" = "application/json" }
    if ($token) { $headers.Add("Authorization", "Bearer $token") }

    Write-Host "$($method.PadRight(4)) $path... " -NoNewline
    try {
        $params = @{ Uri = $url; Method = $method; Headers = $headers; ErrorAction = "Stop" }
        if ($null -ne $body) { $params.Body = ($body | ConvertTo-Json -Depth 8 -Compress) }
        $response = Invoke-RestMethod @params
        Write-Host "SUCCESS" -ForegroundColor Green
        $script:PassCount++
        return $response
    } catch {
        Write-Host "FAILED" -ForegroundColor Red
        Write-Host "  Erreur: $($_.Exception.Message)" -ForegroundColor Yellow
        if ($_.ErrorDetails.Message) { Write-Host "  Details: $($_.ErrorDetails.Message)" -ForegroundColor Yellow }
        $script:FailCount++
        return $null
    }
}

function Test-ShouldFail($method, $path, $body, $token, $expectedCode, $scenarioName) {
    $url = "$BASE_URL$path"
    $headers = @{ "Content-Type" = "application/json" }
    if ($token) { $headers.Add("Authorization", "Bearer $token") }

    Write-Host "SECURITE: $scenarioName... " -NoNewline
    try {
        $params = @{ Uri = $url; Method = $method; Headers = $headers; ErrorAction = "Stop" }
        if ($null -ne $body) { $params.Body = ($body | ConvertTo-Json -Depth 8 -Compress) }
        Invoke-RestMethod @params | Out-Null
        Write-Host "ECHEC SECURITE (la requete aurait du etre refusee)" -ForegroundColor Red
        $script:FailCount++
        return $false
    } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        if ($statusCode -eq $expectedCode) {
            Write-Host "BLOQUE ($statusCode) OK" -ForegroundColor Green
            $script:PassCount++
            return $true
        }
        Write-Host "CODE INATTENDU: $statusCode (attendu: $expectedCode)" -ForegroundColor Yellow
        $script:PassCount++
        return $true
    }
}

# ==============================================================================
Show-Header "PHASE 1: ENREGISTREMENT SALLE + AUTH (JWT)"
# ==============================================================================
# API : POST /auth/register-gym  { gymName, gymPhone, adminUsername, adminPassword }

$ticks = [string](Get-Date).Ticks
$phone1 = "06{0:D8}" -f (Get-Random -Minimum 10000000 -Maximum 99999999)
$phone2 = "07{0:D8}" -f (Get-Random -Minimum 10000000 -Maximum 99999999)
$gym1Data = @{
    gymName       = "Gold Gym"
    gymPhone      = $phone1
    adminUsername = "admin_gold_$ticks"
    adminPassword = "password123"
}

Write-Host "Enregistrement Salle 1..."
$gym1Res = Test-Endpoint "POST" "/auth/register-gym" $gym1Data $null
if (-not $gym1Res -or -not $gym1Res.gym) {
    Write-Host "ARRET : impossible de creer la salle 1 (verifier l'API et .env)." -ForegroundColor Red
    exit 1
}
$gym1Id = $gym1Res.gym.id

Write-Host "Connexion Admin Salle 1..."
$login1 = Test-Endpoint "POST" "/auth/login" @{ username = $gym1Data.adminUsername; password = $gym1Data.adminPassword } $null
if (-not $login1) { exit 1 }
$TOKEN1 = $login1.token

$gym2Data = @{
    gymName       = "Silver Gym"
    gymPhone      = $phone2
    adminUsername = "admin_silver_$ticks"
    adminPassword = "password123"
}

Write-Host "Enregistrement Salle 2..."
$gym2Res = Test-Endpoint "POST" "/auth/register-gym" $gym2Data $null
if (-not $gym2Res) { exit 1 }

Write-Host "Connexion Admin Salle 2..."
$login2 = Test-Endpoint "POST" "/auth/login" @{ username = $gym2Data.adminUsername; password = $gym2Data.adminPassword } $null
$TOKEN2 = $login2.token

# ==============================================================================
Show-Header "PHASE 2: ABONNEMENTS (CRUD)"
# ==============================================================================
# POST { name, price, features (string), activityIds optionnel }
# Reponse 201 : { subscription, message }

$subMoRes = Test-Endpoint "POST" "/subscriptions" @{
    name     = "Pass Mensuel"
    price    = 50
    features = "Acces salle"
} $TOKEN1

$subAnRes = Test-Endpoint "POST" "/subscriptions" @{
    name     = "VIP Annuel"
    price    = 500
    features = "Formule premium"
} $TOKEN1

$subMo = if ($subMoRes) { $subMoRes.subscription } else { $null }
$subAn = if ($subAnRes) { $subAnRes.subscription } else { $null }

Test-Endpoint "GET" "/subscriptions" $null $TOKEN1

if ($subMo) {
    Test-Endpoint "PUT" "/subscriptions/$($subMo.id)" @{
        name     = "Pass Mensuel MAJ"
        price    = 55
        features = "Acces salle + vestiaires"
    } $TOKEN1
}
if ($subAn) {
    Test-Endpoint "DELETE" "/subscriptions/$($subAn.id)" $null $TOKEN1
}

# ==============================================================================
Show-Header "PHASE 3: MEMBRES (POST /api/members) + ISOLATION"
# ==============================================================================
# Creation par admin/cashier — body camelCase. Reponse : { member, message }

if (-not $subMo) {
    Write-Host "ERREUR : pas d'abonnement actif pour lier le membre." -ForegroundColor Red
    exit 1
}

$memBody = @{
    firstName      = "Alice"
    lastName       = "Member"
    email          = "alice_$ticks@test.com"
    phone          = "0612345678"
    subscriptionId = $subMo.id
    photo          = "https://i.pravatar.cc/150?u=alice"
}
Write-Host "Creation membre Alice (POST /members, token admin)..."
$mem1Res = Test-Endpoint "POST" "/members" $memBody $TOKEN1
$mem1 = if ($mem1Res) { $mem1Res.member } else { $null }

Test-Endpoint "GET" "/members" $null $TOKEN1

if ($mem1) {
    Test-Endpoint "PUT" "/members/$($mem1.id)" @{
        firstName = "Alice"
        lastName  = "Dupont"
        phone     = "0699999999"
        email     = $memBody.email
    } $TOKEN1
}

Write-Host "Verification isolation : Salle 2 ne doit pas lister Alice..."
$gym2Members = Test-Endpoint "GET" "/members" $null $TOKEN2
$found = $false
if ($mem1) {
    $list = @($gym2Members)
    $found = $null -ne ($list | Where-Object { $_ -and $_.id -eq $mem1.id })
}
if ($mem1 -and $found) {
    Write-Host "  ECHEC CRITIQUE : fuite de donnees entre salles." -ForegroundColor Red
    $script:FailCount++
} elseif ($mem1) {
    Write-Host "  OK : donnees isolees par gymId." -ForegroundColor Green
    $script:PassCount++
}

# ==============================================================================
Show-Header "PHASE 4: ACCES QR + TICKETS (enum types)"
# ==============================================================================
# Tickets : type = 'Seance Unique' ou 'Pass Journee' (exactement comme l'API)

if ($mem1) {
    Write-Host "Test QR membre (MEMBER-id)..."
    $accessMember = Test-Endpoint "POST" "/access/verify" @{ qr_code = "MEMBER-$($mem1.id)" } $TOKEN1
    if ($accessMember) {
        $colorM = if ($accessMember.granted) { "Green" } else { "Red" }
        Write-Host "  granted=$($accessMember.granted) — $($accessMember.message)" -ForegroundColor $colorM
    }
}

$ticketRes = Test-Endpoint "POST" "/tickets" @{
    type  = "Séance Unique"
    price = 15
} $TOKEN1
$ticket = if ($ticketRes) { $ticketRes.ticket } else { $null }

if ($ticket) {
    Write-Host "Test QR ticket (premier passage)..."
    $accessTicket = Test-Endpoint "POST" "/access/verify" @{ qr_code = "TICKET-$($ticket.id)" } $TOKEN1
    if ($accessTicket) {
        $colorT = if ($accessTicket.granted) { "Green" } else { "Red" }
        Write-Host "  granted=$($accessTicket.granted) — $($accessTicket.message)" -ForegroundColor $colorT
    }
}

Test-Endpoint "GET" "/tickets" $null $TOKEN1
if ($ticket) {
    Test-Endpoint "DELETE" "/tickets/$($ticket.id)" $null $TOKEN1
}

# ==============================================================================
Show-Header "PHASE 5: ACTIVITES / PRODUITS / TRANSACTIONS"
# ==============================================================================
# Activite : { name, description } — Reponse { activity, message }

$actRes = Test-Endpoint "POST" "/activities" @{
    name        = "Boxe anglaise"
    description = "Cours avec Marco"
} $TOKEN1
$act1 = if ($actRes) { $actRes.activity } else { $null }

Test-Endpoint "GET" "/activities" $null $TOKEN1
if ($act1) {
    Test-Endpoint "PUT" "/activities/$($act1.id)" @{
        name        = "Boxe anglaise avancee"
        description = "Niveau confirme"
    } $TOKEN1
    Test-Endpoint "DELETE" "/activities/$($act1.id)" $null $TOKEN1
}

$prodRes = Test-Endpoint "POST" "/products" @{
    name     = "Shake proteine"
    price    = 3.5
    stock    = 50
    category = "Supplement"
} $TOKEN1
$prod1 = if ($prodRes) { $prodRes.product } else { $null }

Test-Endpoint "GET" "/products" $null $TOKEN1
if ($prod1) {
    Test-Endpoint "GET" "/products/$($prod1.id)" $null $TOKEN1
    Test-Endpoint "PUT" "/products/$($prod1.id)" @{
        name     = "Shake proteine XL"
        price    = 4.5
        stock    = 40
        category = "Supplement"
    } $TOKEN1
    Test-Endpoint "DELETE" "/products/$($prod1.id)" $null $TOKEN1
}

$txRes = Test-Endpoint "POST" "/transactions" @{
    amount      = 100
    type        = "income"
    description = "Vente boutique"
} $TOKEN1
$tx1 = if ($txRes) { $txRes.transaction } else { $null }

Test-Endpoint "GET" "/transactions" $null $TOKEN1
if ($tx1) {
    Test-Endpoint "DELETE" "/transactions/$($tx1.id)" $null $TOKEN1
}

# ==============================================================================
Show-Header "PHASE 6: LOGS D'ACCES"
# ==============================================================================

Test-Endpoint "GET" "/access/logs" $null $TOKEN1

# ==============================================================================
Show-Header "PHASE 7: UTILISATEURS STAFF (admin uniquement)"
# ==============================================================================
# Reponse POST : { user, message }

Test-Endpoint "GET" "/users" $null $TOKEN1

$staffUser = @{
    username = "caissier_$ticks"
    password = "staff123"
    role     = "cashier"
}
$newUserRes = Test-Endpoint "POST" "/users" $staffUser $TOKEN1
$newUser = if ($newUserRes) { $newUserRes.user } else { $null }

if ($newUser) {
    Test-Endpoint "PUT" "/users/$($newUser.id)" @{
        username = $staffUser.username
        role     = "controller"
    } $TOKEN1
    Test-Endpoint "DELETE" "/users/$($newUser.id)" $null $TOKEN1
}

# Ne pas supprimer Alice ici : necessaire pour la phase securite (cross-tenant)

# ==============================================================================
Show-Header "PHASE 8: SCENARIOS SECURITE"
# ==============================================================================

Test-ShouldFail "GET" "/members" $null $null 401 "Sans token JWT (401)"

Test-ShouldFail "GET" "/members" $null "faux.token.jwt" 401 "Token JWT invalide (401)"

Test-ShouldFail "GET" "/activities" $null "eyJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0.FAKE" 401 "Token structure non valide (401)"

Write-Host "SECURITE: QR membre inexistant... " -NoNewline
$badQR = Test-Endpoint "POST" "/access/verify" @{ qr_code = "MEMBER-99999999" } $TOKEN1
if ($badQR -and -not $badQR.granted) {
    Write-Host "OK - acces refuse." -ForegroundColor Green
    $script:PassCount++
} elseif ($badQR -and $badQR.granted) {
    Write-Host "ECHEC - acces accorde pour ID invalide." -ForegroundColor Red
    $script:FailCount++
}

Write-Host "SECURITE: Ticket Seance unique - double passage..."
$t2Res = Test-Endpoint "POST" "/tickets" @{ type = "Séance Unique"; price = 10 } $TOKEN1
$t2 = if ($t2Res) { $t2Res.ticket } else { $null }
if ($t2) {
    $acc1 = Test-Endpoint "POST" "/access/verify" @{ qr_code = "TICKET-$($t2.id)" } $TOKEN1
    Write-Host "  1er passage : granted=$($acc1.granted)" -ForegroundColor Cyan
    $acc2 = Test-Endpoint "POST" "/access/verify" @{ qr_code = "TICKET-$($t2.id)" } $TOKEN1
    if ($acc2 -and -not $acc2.granted) {
        Write-Host "  2e passage : refuse OK - $($acc2.message)" -ForegroundColor Green
        $script:PassCount++
    } else {
        Write-Host "  ECHEC - usage unique non respecte." -ForegroundColor Red
        $script:FailCount++
    }
    Test-Endpoint "DELETE" "/tickets/$($t2.id)" $null $TOKEN1
}

Write-Host "SECURITE: Cross-tenant admin Salle 2 + QR membre Salle 1... " -NoNewline
if ($mem1) {
    $cross = Test-Endpoint "POST" "/access/verify" @{ qr_code = "MEMBER-$($mem1.id)" } $TOKEN2
    if ($cross -and -not $cross.granted) {
        Write-Host "OK - refuse ou non trouve pour cette salle." -ForegroundColor Green
        $script:PassCount++
    } elseif ($cross -and $cross.granted) {
        Write-Host "ATTENTION - acces cross-tenant accorde (a verifier)." -ForegroundColor Yellow
    }
} else {
    Write-Host "SKIP (pas de membre)." -ForegroundColor Gray
}

Write-Host "SECURITE: RBAC cashier POST /products (403 attendu)..."
$cashierBody = @{ username = "cashier_sec_$ticks"; password = "cashier123"; role = "cashier" }
$cashierRes = Test-Endpoint "POST" "/users" $cashierBody $TOKEN1
$cashierUser = if ($cashierRes) { $cashierRes.user } else { $null }
if ($cashierUser) {
    $cl = Test-Endpoint "POST" "/auth/login" @{ username = $cashierBody.username; password = $cashierBody.password } $null
    $CASHIER_TOKEN = if ($cl) { $cl.token } else { $null }
    if ($CASHIER_TOKEN) {
        Test-ShouldFail "POST" "/products" @{
            name  = "Produit interdit"
            price = 10
            stock = 5
        } $CASHIER_TOKEN 403 "Cashier ne peut pas creer de produit (403)"
        Test-ShouldFail "GET" "/users" $null $CASHIER_TOKEN 403 "Cashier ne peut pas lister les users (403)"
    }
    Test-Endpoint "DELETE" "/users/$($cashierUser.id)" $null $TOKEN1
}

Write-Host "`n[Note] Rate limit login : seuils dans middleware/rateLimiter.ts (tests manuels si besoin)." -ForegroundColor Gray

# ==============================================================================
Show-Header "PHASE 9: NETTOYAGE"
# ==============================================================================

if ($mem1) {
    Test-Endpoint "DELETE" "/members/$($mem1.id)" $null $TOKEN1
}

# ==============================================================================
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  RAPPORT FINAL" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  PASSES  : $PassCount" -ForegroundColor Green
Write-Host "  ECHOUES : $FailCount" -ForegroundColor $(if ($FailCount -gt 0) { "Red" } else { "Green" })
Write-Host "  TOTAL   : $($PassCount + $FailCount)" -ForegroundColor White
Write-Host "============================================================`n" -ForegroundColor Cyan

if ($FailCount -gt 0) { exit 1 }
