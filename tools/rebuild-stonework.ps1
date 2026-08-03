param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Destination
)

$ErrorActionPreference = 'Stop'
$project = Get-Content -LiteralPath $Source -Raw | ConvertFrom-Json
$objects = [System.Collections.Generic.List[object]]::new()
foreach ($object in $project.scene.objects) { $objects.Add($object) }

function Find-Object([string]$Name) {
  return $objects | Where-Object { $_.name -eq $Name } | Select-Object -First 1
}

function Remove-Matching([string]$Pattern) {
  for ($i = $objects.Count - 1; $i -ge 0; $i--) {
    if ($objects[$i].name -match $Pattern) { $objects.RemoveAt($i) }
  }
}

function Add-Stone(
  [object]$Template,
  [string]$Id,
  [string]$Name,
  [double[]]$Position,
  [double[]]$Scale,
  [int]$TextureRotation
) {
  $stone = $Template | ConvertTo-Json -Depth 40 | ConvertFrom-Json
  $stone.id = $Id
  $stone.name = $Name
  $stone.position = $Position
  $stone.pivot = $null
  $stone.scale = $Scale
  $stone.textureRotation = $TextureRotation
  $objects.Add($stone)
}

function Add-Course(
  [object]$Template,
  [string]$Wall,
  [int]$Row,
  [double]$Fixed,
  [double]$Y,
  [double]$Start,
  [double]$End,
  [int]$FullCount,
  [bool]$RunsAlongX,
  [string[]]$Palette
) {
  $gap = 0.035
  $length = $End - $Start
  $pieces = @()
  if (($Row % 2) -eq 1) {
    $pieceLength = ($length - (($FullCount - 1) * $gap)) / $FullCount
    for ($i = 0; $i -lt $FullCount; $i++) { $pieces += $pieceLength }
  } else {
    $innerCount = [Math]::Max(1, $FullCount - 1)
    $fullLength = ($length - ($FullCount * $gap)) / $FullCount
    $halfLength = $fullLength / 2
    $pieces += $halfLength
    for ($i = 0; $i -lt $innerCount; $i++) { $pieces += $fullLength }
    $pieces += $halfLength
    $used = ($pieces | Measure-Object -Sum).Sum + (($pieces.Count - 1) * $gap)
    $correction = ($length - $used) / 2
    $pieces[0] += $correction
    $pieces[$pieces.Count - 1] += $correction
  }

  $cursor = $Start
  for ($i = 0; $i -lt $pieces.Count; $i++) {
    $pieceLength = [double]$pieces[$i]
    $center = $cursor + ($pieceLength / 2)
    $height = if (($Row % 3) -eq 0) { 0.42 } else { 0.40 }
    if ($RunsAlongX) {
      $position = [double[]]@($center, $Y, $Fixed)
      $scale = [double[]]@($pieceLength, $height, 0.42)
      $textureRotation = 0
    } else {
      $position = [double[]]@($Fixed, $Y, $center)
      $scale = [double[]]@(0.42, $height, $pieceLength)
      $textureRotation = 90
    }
    $name = "$Wall fieldstone rebuilt row $Row block $($i + 1)"
    Add-Stone $Template "rebuilt-$($Wall.ToLower())-r$row-b$($i + 1)" $name $position $scale $textureRotation
    $objects[$objects.Count - 1].color = $Palette[($i + $Row) % $Palette.Count]
    $cursor += $pieceLength + $gap
  }
}

$template = Find-Object 'Right gable fieldstone row 1 block 4 copy'
if (-not $template) { throw 'The manually corrected right-gable template stone is missing.' }

# Preserve every manually corrected stone. Rebuild only the untouched left gable.
Remove-Matching '^Left gable fieldstone row '
$ys = @(0.30, 0.76, 1.22, 1.68, 2.14, 2.60)
$palette = @('#5f625e', '#77756f', '#85827a', '#6d706b')
for ($row = 1; $row -le 6; $row++) {
  Add-Course $template 'Left gable' $row -3.86 $ys[$row - 1] -2.225 2.225 4 $false $palette
}

# Mirror the hand-corrected positive-X corner bond onto the untouched negative-X corners.
for ($row = 1; $row -le 6; $row++) {
  $rightFront = Find-Object "Corner quoin 1 1 row $row"
  $rightRear = Find-Object "Corner quoin 1 1 row $row copy"
  $leftFront = Find-Object "Corner quoin -1 1 row $row"
  $leftRear = Find-Object "Corner quoin -1 -1 row $row"
  if ($rightFront -and $leftFront) {
    $leftFront.position = [double[]]@(-[Math]::Abs([double]$rightFront.position[0]), [double]$rightFront.position[1], [Math]::Abs([double]$rightFront.position[2]))
    $leftFront.scale = [double[]]@([double]$rightFront.scale[0], [double]$rightFront.scale[1], [double]$rightFront.scale[2])
    $leftFront.textureRotation = $rightFront.textureRotation
  }
  if ($rightRear -and $leftRear) {
    $leftRear.position = [double[]]@(-[Math]::Abs([double]$rightRear.position[0]), [double]$rightRear.position[1], -[Math]::Abs([double]$rightRear.position[2]))
    $leftRear.scale = [double[]]@([double]$rightRear.scale[0], [double]$rightRear.scale[1], [double]$rightRear.scale[2])
    $leftRear.textureRotation = $rightRear.textureRotation
  }
}

# Rebuild the untouched part left of the front door. The user's corrected
# right-hand door masonry remains the source-of-truth and is not replaced.
Remove-Matching '^Front fieldstone row \d+ block [1-3]$'
for ($row = 1; $row -le 6; $row++) {
  $leftCorner = Find-Object "Corner quoin -1 1 row $row"
  $start = [double]$leftCorner.position[0] + ([double]$leftCorner.scale[0] / 2)
  Add-Course $template 'Front left' $row 2.56 $ys[$row - 1] $start -1.195 2 $true $palette
}

# Rebuild the long, previously untouched rear run up to the door. This uses
# the same alternating full/half-stone bond as the corrected short wall.
Remove-Matching '^Rear fieldstone row '
for ($row = 1; $row -le 6; $row++) {
  $leftCorner = Find-Object "Corner quoin -1 -1 row $row"
  $start = [double]$leftCorner.position[0] + ([double]$leftCorner.scale[0] / 2)
  Add-Course $template 'Rear left' $row -2.56 $ys[$row - 1] $start 1.09 4 $true $palette
}

$project.scene.objects = $objects.ToArray()
$project.name = 'blackstone-timber-manor_stenar'
$json = $project | ConvertTo-Json -Depth 60
[System.IO.File]::WriteAllText($Destination, $json, [System.Text.UTF8Encoding]::new($false))
