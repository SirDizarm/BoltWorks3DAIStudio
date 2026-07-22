param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Destination
)

$ErrorActionPreference = 'Stop'
$project = Get-Content -LiteralPath $Source -Raw | ConvertFrom-Json
$allObjects = @($project.scene.objects)
$floorTexturePath = Join-Path $PSScriptRoot '..\assets\textures\aged-wide-oak-floorboards.png'
$beamTexturePath = Join-Path $PSScriptRoot '..\assets\textures\aged-dark-oak-beams.png'
$ironTexturePath = Join-Path $PSScriptRoot '..\assets\textures\hammered-black-iron.png'
foreach ($requiredTexturePath in @($floorTexturePath, $beamTexturePath, $ironTexturePath)) {
  if (-not (Test-Path -LiteralPath $requiredTexturePath)) { throw "Missing embedded texture source: $requiredTexturePath" }
}
$floorTextureDataUrl = 'data:image/png;base64,' + [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($floorTexturePath))
$beamTextureDataUrl = 'data:image/png;base64,' + [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($beamTexturePath))
$ironTextureDataUrl = 'data:image/png;base64,' + [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($ironTexturePath))
$template = $allObjects | Where-Object { $_.name -eq 'Right gable fieldstone row 1 block 4 copy' } | Select-Object -First 1
if (-not $template) {
  $template = $allObjects | Where-Object { $_.name -match '(?i)(fieldstone|masonry row)' } | Select-Object -First 1
}
if (-not $template) { throw 'No textured fieldstone template was found.' }

$kept = [System.Collections.Generic.List[object]]::new()
foreach ($object in $allObjects) {
  $generatedFinish = ($object.name -like 'Finished aged oak plank floor*') -or
    ($object.name -like '* mortar backing*') -or
    ($object.name -like 'Cast iron stove*') -or
    ($object.groupId -eq 'interior-roof-frame')
  $obsoleteFixture = $object.groupName -eq 'Lamp and Torch Fixtures'
  if (($object.name -notmatch '(?i)(fieldstone|half stone|corner quoin|masonry row|L corner stone)') -and (-not $generatedFinish) -and (-not $obsoleteFixture)) {
    $kept.Add($object)
  }
}

$palette = @('#5f625e', '#77756f', '#85827a', '#6d706b', '#696b67', '#7c7a74')
$factors = @(0.82, 1.16, 0.94, 1.24, 0.88, 1.08, 0.76, 1.19, 0.97, 1.12)
$ys = @(0.30, 0.76, 1.22, 1.68, 2.14, 2.60)
$script:stoneNumber = 0

function Copy-Template {
  return $template | ConvertTo-Json -Depth 40 | ConvertFrom-Json
}

function New-LGeometry([double]$ArmX, [double]$ArmZ, [double]$Height) {
  # Full wall-depth veneer: the inner face now reaches the basement backing
  # walls instead of leaving a visible hollow cavity behind the stones.
  $halfWall = 0.20
  $halfHeight = $Height / 2
  $outline = @(
    [pscustomobject]@{ x = -$ArmX; z = -$halfWall },
    [pscustomobject]@{ x = -$halfWall; z = -$halfWall },
    [pscustomobject]@{ x = -$halfWall; z = -$ArmZ },
    [pscustomobject]@{ x =  $halfWall; z = -$ArmZ },
    [pscustomobject]@{ x =  $halfWall; z = -$halfWall },
    [pscustomobject]@{ x =  $halfWall; z =  $halfWall },
    [pscustomobject]@{ x = -$ArmX; z =  $halfWall }
  )
  $positions = [System.Collections.Generic.List[double]]::new()
  $normals = [System.Collections.Generic.List[double]]::new()
  $uvs = [System.Collections.Generic.List[double]]::new()

  $addTriangle = {
    param([object]$A, [object]$B, [object]$C, [object]$Normal, [object]$UvA, [object]$UvB, [object]$UvC)
    $vertices = @($A, $B, $C)
    $triangleUvs = @($UvA, $UvB, $UvC)
    for ($vertexIndex = 0; $vertexIndex -lt 3; $vertexIndex++) {
      $vertex = $vertices[$vertexIndex]
      $positions.Add([double]$vertex.x); $positions.Add([double]$vertex.y); $positions.Add([double]$vertex.z)
      $normals.Add([double]$Normal.x); $normals.Add([double]$Normal.y); $normals.Add([double]$Normal.z)
      $uvs.Add([double]$triangleUvs[$vertexIndex].u); $uvs.Add([double]$triangleUvs[$vertexIndex].v)
    }
  }

  $bottom = @($outline | ForEach-Object { [pscustomobject]@{ x = [double]$_.x; y = -$halfHeight; z = [double]$_.z } })
  $top = @($outline | ForEach-Object { [pscustomobject]@{ x = [double]$_.x; y = $halfHeight; z = [double]$_.z } })
  $topTriangles = @(
    [pscustomobject]@{ a=0; b=5; c=4 },
    [pscustomobject]@{ a=0; b=6; c=5 },
    [pscustomobject]@{ a=1; b=3; c=2 },
    [pscustomobject]@{ a=1; b=4; c=3 }
  )

  foreach ($triangle in $topTriangles) {
    $triangleIndices = @($triangle.a, $triangle.b, $triangle.c)
    $triangleUvs = @()
    foreach ($index in $triangleIndices) {
      $triangleUvs += [pscustomobject]@{
        u = ([double]$outline[$index].x + $ArmX) / ($ArmX + $halfWall)
        v = ([double]$outline[$index].z + $ArmZ) / ($ArmZ + $halfWall)
      }
    }
    $up = [pscustomobject]@{x=0;y=1;z=0}
    $down = [pscustomobject]@{x=0;y=-1;z=0}
    & $addTriangle $top[$triangle.a] $top[$triangle.b] $top[$triangle.c] $up $triangleUvs[0] $triangleUvs[1] $triangleUvs[2]
    & $addTriangle $bottom[$triangle.c] $bottom[$triangle.b] $bottom[$triangle.a] $down $triangleUvs[2] $triangleUvs[1] $triangleUvs[0]
  }

  $boundary = @(0,1,2,3,5,6)
  for ($i = 0; $i -lt $boundary.Count; $i++) {
    $a = $boundary[$i]
    $b = $boundary[($i + 1) % $boundary.Count]
    $dx = [double]$outline[$b].x - [double]$outline[$a].x
    $dz = [double]$outline[$b].z - [double]$outline[$a].z
    $edgeLength = [Math]::Sqrt(($dx * $dx) + ($dz * $dz))
    $normal = [pscustomobject]@{ x = $dz / $edgeLength; y = 0; z = -$dx / $edgeLength }
    $uv00=[pscustomobject]@{u=0;v=0}; $uv01=[pscustomobject]@{u=0;v=1}
    $uv11=[pscustomobject]@{u=1;v=1}; $uv10=[pscustomobject]@{u=1;v=0}
    & $addTriangle $bottom[$a] $top[$a] $top[$b] $normal $uv00 $uv01 $uv11
    & $addTriangle $bottom[$a] $top[$b] $bottom[$b] $normal $uv00 $uv11 $uv10
  }
  return [pscustomobject]@{
    positions = $positions.ToArray()
    normals = $normals.ToArray()
    uvs = $uvs.ToArray()
  }
}

function Add-LCorner {
  param(
    [string]$Name,
    [int]$Row,
    [double]$X,
    [double]$Z,
    [double]$RotationY,
    [double]$ArmX,
    [double]$ArmZ,
    [int]$ColorPhase
  )
  $stone = Copy-Template
  $slug = ($Name.ToLowerInvariant() -replace '[^a-z0-9]+', '-')
  $height = 0.38
  $stone.id = "masonry-v3-$slug-r$row"
  $stone.name = "$Name L corner stone row $Row"
  $stone.shape = 'box'
  $stone.geometry = New-LGeometry $ArmX $ArmZ $height
  $stone.position = [double[]]@($X, $ys[$Row - 1], $Z)
  $stone.rotation = [double[]]@(0, $RotationY, 0)
  $stone.scale = [double[]]@(1, 1, 1)
  $stone.pivot = $null
  $stone.color = $palette[($ColorPhase + $Row) % $palette.Count]
  $stone.textureRotation = 0
  $stone.groupId = 'stonework'
  $stone.groupName = 'Interlocked L Corner Masonry'
  $kept.Add($stone)
}

function Add-Course {
  param(
    [string]$Wall,
    [int]$Row,
    [double]$Fixed,
    [double]$Start,
    [double]$End,
    [bool]$AlongX,
    [int]$Phase,
    [ValidateSet('none','start','end')][string]$DoorSide = 'none'
  )

  $length = $End - $Start
  if ($length -le 0.05) { return }
  $gap = 0.04
  $brickLength = 1.04
  $pitch = $brickLength + $gap
  $minimumJambStone = 0.45
  $usableStart = $Start + $gap
  $usableEnd = $End - $gap
  $usableLength = $usableEnd - $usableStart
  if ($usableLength -le 0.05) { return }

  $pieces = [System.Collections.Generic.List[object]]::new()
  if ($DoorSide -eq 'none') {
    $count = [Math]::Max(1, [int][Math]::Round(($usableLength + $gap) / $pitch))
    $requiredLength = ($count * $brickLength) + (($count - 1) * $gap)
    if ([Math]::Abs($requiredLength - $usableLength) -gt 0.002) {
      throw "$Wall row $Row cannot use the standard masonry module without changing its corner arms."
    }
    $cursor = $usableStart
    for ($pieceIndex = 0; $pieceIndex -lt $count; $pieceIndex++) {
      $pieces.Add([pscustomobject]@{ Start = $cursor; Length = $brickLength })
      $cursor += $pitch
    }
  } else {
    # Only the stone touching a doorway may deviate from the standard length.
    # Reducing the full-stone count when necessary prevents tiny jamb fillers.
    $fullCount = [Math]::Max(0, [int][Math]::Floor(($usableLength - $minimumJambStone) / $pitch))
    $jambLength = $usableLength - ($fullCount * $pitch)
    if ($jambLength -lt $minimumJambStone) {
      throw "$Wall row $Row produced a jamb stone shorter than $minimumJambStone."
    }
    if ($DoorSide -eq 'end') {
      $cursor = $usableStart
      for ($pieceIndex = 0; $pieceIndex -lt $fullCount; $pieceIndex++) {
        $pieces.Add([pscustomobject]@{ Start = $cursor; Length = $brickLength })
        $cursor += $pitch
      }
      $pieces.Add([pscustomobject]@{ Start = $cursor; Length = $jambLength })
    } else {
      $pieces.Add([pscustomobject]@{ Start = $usableStart; Length = $jambLength })
      $cursor = $usableStart + $jambLength + $gap
      for ($pieceIndex = 0; $pieceIndex -lt $fullCount; $pieceIndex++) {
        $pieces.Add([pscustomobject]@{ Start = $cursor; Length = $brickLength })
        $cursor += $pitch
      }
    }
  }

  for ($i = 0; $i -lt $pieces.Count; $i++) {
    $pieceLength = [double]$pieces[$i].Length
    $center = [double]$pieces[$i].Start + ($pieceLength / 2)
    $stone = Copy-Template
    $script:stoneNumber++
    $slug = ($Wall.ToLowerInvariant() -replace '[^a-z0-9]+', '-')
    $stone.id = "masonry-v2-$slug-r$row-b$($i + 1)"
    $stone.name = "$Wall masonry row $Row stone $($i + 1)"
    $stone.pivot = $null
    $stone.rotation = [double[]]@(0, 0, 0)
    $height = 0.38
    if ($AlongX) {
      $stone.position = [double[]]@($center, $ys[$Row - 1], $Fixed)
      $stone.scale = [double[]]@($pieceLength, $height, 0.40)
      $stone.textureRotation = 0
    } else {
      $stone.position = [double[]]@($Fixed, $ys[$Row - 1], $center)
      $stone.scale = [double[]]@(0.40, $height, $pieceLength)
      $stone.textureRotation = 90
    }
    $stone.color = $palette[($Phase + $Row + ($i * 2)) % $palette.Count]
    $stone.groupId = 'stonework'
    $stone.groupName = 'Interlocked Fieldstone Masonry'
    $kept.Add($stone)
  }
}

for ($row = 1; $row -le 6; $row++) {
  $odd = (($row % 2) -eq 1)

  # Every facade uses the same 1.04 + 0.04 module.  Swapping the corner-arm
  # reach by exactly half a module (0.54) creates the running bond without
  # moving or intersecting any straight stone.
  $frontLeftArm  = if ($odd) { 0.88 } else { 1.42 }
  $frontRightArm = if ($odd) { 1.42 } else { 0.88 }
  $rearLeftArm   = if ($odd) { 1.42 } else { 0.88 }
  $rearRightArm  = 0.80
  $leftRearArm   = if ($odd) { 0.65 } else { 1.19 }
  $leftFrontArm  = if ($odd) { 1.19 } else { 0.65 }
  $rightRearArm  = if ($odd) { 1.19 } else { 0.65 }
  $rightFrontArm = if ($odd) { 0.65 } else { 1.19 }

  Add-LCorner 'Front right' $row  3.86  2.56    0 $frontRightArm $rightFrontArm 1
  Add-LCorner 'Front left'  $row -3.86  2.56  -90 $leftFrontArm  $frontLeftArm  3
  Add-LCorner 'Rear left'   $row -3.86 -2.56  180 $rearLeftArm   $leftRearArm   5
  Add-LCorner 'Rear right'  $row  3.86 -2.56   90 $rightRearArm  $rearRightArm  7

  # Front door opening: -0.86 to 0.86.  The frame overlaps each jamb by 0.04.
  Add-Course 'Front left'  $row  2.56 (-3.86 + $frontLeftArm) -0.86 $true  1 'end'
  Add-Course 'Front right' $row  2.56 0.86 (3.86 - $frontRightArm) $true  5 'start'

  # Rear service door opening: 1.40 to 3.10.
  Add-Course 'Rear left'   $row -2.56 (-3.86 + $rearLeftArm) 1.40 $true  7 'end'
  Add-Course 'Rear right'  $row -2.56 3.10 (3.86 - $rearRightArm) $true  3 'start'

  Add-Course 'Left side'   $row -3.86 (-2.56 + $leftRearArm) (2.56 - $leftFrontArm) $false 2
  Add-Course 'Right side'  $row  3.86 (-2.56 + $rightRearArm) (2.56 - $rightFrontArm) $false 8
}

# Close the visible reveal around both basement doors without intersecting the
# stonework.  The frame outer edges finish exactly at the masonry door edges.
function Set-DoorPackage {
  param(
    [string]$Prefix,
    [double]$CenterX,
    [double]$HalfOuterWidth,
    [double]$WallSign
  )

  $outerWidth = $HalfOuterWidth * 2
  $jambCenterOffset = $HalfOuterWidth - 0.10
  $slabWidth = (($jambCenterOffset - 0.10) * 2) - 0.04
  $plankOffset = $slabWidth * 0.31

  foreach ($object in $kept) {
    if ($object.name -notlike "$Prefix*") { continue }

    # Recess the complete door assembly 0.24 scene units into the wall.  Use
    # canonical depths per component so rebuilding an already rebuilt project
    # never accumulates another offset.
    $canonicalDepth = if ($object.name -match 'dark recess$') { 2.68 }
      elseif ($object.name -match 'interior iron strap') { 2.445 }
      elseif ($object.name -match 'interior (left jamb|right jamb|lintel)$') { 2.48 }
      elseif ($object.name -match 'interior oak face$') { 2.51 }
      elseif ($object.name -match 'interior plank') { 2.475 }
      elseif ($object.name -match 'interior ring handle$') { 2.42 }
      elseif ($object.name -match 'iron strap') { 2.925 }
      elseif ($object.name -match '(left jamb|right jamb|lintel)$') { 2.87 }
      elseif ($object.name -match 'oak slab$') { 2.84 }
      elseif ($object.name -match 'plank') { 2.895 }
      elseif ($object.name -match 'ring handle$') { 2.96 }
      else { $null }
    if ($null -ne $canonicalDepth) {
      $object.position[2] = $WallSign * ($canonicalDepth - 0.24)
    }

    if ($object.name -match 'dark recess$') {
      $object.position[1] = 1.40
      $object.scale[0] = $outerWidth - 0.24
      $object.scale[1] = 2.45
    } elseif ($object.name -match '(oak slab|interior oak face)$') {
      $object.position[1] = 1.40
      $object.scale[0] = $slabWidth
      $object.scale[1] = 2.30
    } elseif ($object.name -match 'plank') {
      $object.position[1] = 1.40
      $object.scale[1] = 2.20
      if ($object.name -match 'plank -0\.34') { $object.position[0] = $CenterX - $plankOffset }
      elseif ($object.name -match 'plank 0\.34') { $object.position[0] = $CenterX + $plankOffset }
      else { $object.position[0] = $CenterX }
    } elseif ($object.name -match 'left jamb$') {
      $object.position[0] = $CenterX - $jambCenterOffset
      $object.position[1] = 1.43
      $object.scale[1] = 2.50
    } elseif ($object.name -match 'right jamb$') {
      $object.position[0] = $CenterX + $jambCenterOffset
      $object.position[1] = 1.43
      $object.scale[1] = 2.50
    } elseif ($object.name -match 'lintel$') {
      $object.position[0] = $CenterX
      # Keep the heavier lintel, but tuck its top beneath the finished floor.
      # This prevents the cellar door frame from protruding into the room above.
      $object.position[1] = 2.57
      $object.scale[0] = $outerWidth
      $object.scale[1] = 0.30
    } elseif ($object.name -match 'iron strap') {
      $object.scale[0] = 0.75
    }
  }
}

Set-DoorPackage 'Front entry door' 0.00 0.90 1
Set-DoorPackage 'Rear service door' 2.25 0.89 -1

foreach ($object in $kept) {
  if ($object.name -in @('Upper floor main deck', 'Upper floor stair entry deck')) {
    $object.position[1] = 2.64
  } elseif ($object.name -match '^(Front|Rear) exposed floor joist') {
    $object.position[1] = 2.75
  } elseif ($object.name -in @('Front threshold', 'Rear threshold')) {
    $object.scale[0] = if ($object.name -eq 'Front threshold') { 1.84 } else { 1.82 }
    $object.position[2] = if ($object.name -eq 'Front threshold') { 2.74 } else { -2.74 }
  } elseif ($object.name -match '^Interior upper flight tread ([1-7])$') {
    # Preserve the turning-landing height but let the upper flight meet the
    # lowered floor instead of protruding through it.
    $stepNumber = [int]$Matches[1]
    $progress = (7 - $stepNumber) / 6.0
    $top = 1.40 + (1.24 * $progress)
    $object.scale[1] = $top - 0.10
    $object.position[1] = ($top + 0.10) / 2.0
  } elseif ($object.name -match '^Upper flight railing post ') {
    $progress = [Math]::Max(0.0, [Math]::Min(1.0, (([double]$object.position[2]) + 1.16) / 2.14))
    $canonicalY = 1.969 + (1.025 * $progress)
    $object.position[1] = $canonicalY - (0.14 * $progress)
  } elseif ($object.name -eq 'Upper flight sloping handrail') {
    $object.position[1] = 2.76
  } elseif ($object.name -match '^Upper stairwell guard post ') {
    $object.position[1] = 3.24
  } elseif ($object.name -eq 'Upper stairwell guard handrail') {
    $object.position[1] = 3.65
  }
}

# The masonry top is y=2.79 and the lowest timber rails originally begin at
# y=2.93.  Lower the complete upper shell by 0.14 so those rails sit directly
# on the cellar wall.  Anchor-based normalization keeps repeated rebuilds
# idempotent even when the generated project is used as the next source.
$upperAnchor = $kept | Where-Object { $_.name -eq 'Front outer plaster below windows' } | Select-Object -First 1
if ($upperAnchor) {
  $upperShift = 3.45 - [double]$upperAnchor.position[1]
  $upperGroups = @('Aged Plaster Infill', 'Heavy Timber Frame', 'Leaded Windows', 'Shingled Gable Roof', 'Stone Chimney')
  foreach ($object in $kept) {
    if (($object.groupName -in $upperGroups) -or ($object.name -like 'Upper rear timber-post sconce*')) {
      $object.position[1] = [double]$object.position[1] + $upperShift
    }
  }
}

# Pull the four lower interior plaster fields down to the finished floor.  Keep
# each existing top edge fixed so window and timber alignment does not change.
$finishedFloorY = 2.79
foreach ($object in $kept) {
  if ($object.name -in @(
    'Front inner plaster below windows',
    'Rear inner plaster below windows',
    'Left inner plaster below window',
    'Right inner plaster below window'
  )) {
    $topEdge = [double]$object.position[1] + ([double]$object.scale[1] / 2.0)
    $newHeight = $topEdge - $finishedFloorY
    $object.scale[1] = $newHeight
    $object.position[1] = $finishedFloorY + ($newHeight / 2.0)
  }
}

# Seat every vertical centre glazing bar into its sill and lintel.  The centre
# bar is also slightly thicker and proud of the diagonal lattice plane, so the
# three textured pieces never render coplanar and cause z-fighting.
foreach ($lead in @($kept | Where-Object { $_.name -like '* center lead' })) {
  switch -Wildcard ($lead.name) {
    'Front upper window * center lead' {
      $lead.position = [double[]]@([double]$lead.position[0], [double]$lead.position[1], 2.698)
      $lead.scale = [double[]]@([double]$lead.scale[0], 1.30, 0.052)
    }
    'Rear upper window * center lead' {
      $lead.position = [double[]]@([double]$lead.position[0], [double]$lead.position[1], -2.698)
      $lead.scale = [double[]]@([double]$lead.scale[0], 1.24, 0.052)
    }
    'Left gable triple window center lead' {
      $lead.position = [double[]]@(-3.998, [double]$lead.position[1], [double]$lead.position[2])
      $lead.scale = [double[]]@(0.052, 1.34, [double]$lead.scale[2])
    }
    'Right gable upper window center lead' {
      $lead.position = [double[]]@(3.998, [double]$lead.position[1], [double]$lead.position[2])
      $lead.scale = [double[]]@(0.052, 1.28, [double]$lead.scale[2])
    }
  }
}

# Close the small horizontal seam below the triangular gable infill.  Preserve
# the lower edge above the windows and extend only the top of the inner plaster.
foreach ($object in $kept) {
  if ($object.name -in @('Left inner plaster above window', 'Right inner plaster above window')) {
    $bottomEdge = [double]$object.position[1] - ([double]$object.scale[1] / 2.0)
    $topEdge = 5.92
    $object.scale[1] = $topEdge - $bottomEdge
    $object.position[1] = $bottomEdge + ([double]$object.scale[1] / 2.0)
  }
}

# Close the narrow exterior seams where the side plaster stopped short of the
# front and rear wall planes.  Extend only toward the corners so window widths
# and the inner edges of the side infill remain unchanged.
foreach ($object in $kept) {
  if ($object.name -in @(
    'Left outer plaster above window',
    'Left outer plaster below window',
    'Right outer plaster above window',
    'Right outer plaster below window'
  )) {
    $object.position[2] = 0.0
    $object.scale[2] = 5.12
  } elseif ($object.name -in @('Left outer front plaster pier', 'Right outer front plaster pier')) {
    $innerEdge = [double]$object.position[2] - ([double]$object.scale[2] / 2.0)
    $object.scale[2] = 2.56 - $innerEdge
    $object.position[2] = $innerEdge + ([double]$object.scale[2] / 2.0)
  } elseif ($object.name -in @('Left outer rear plaster pier', 'Right outer rear plaster pier')) {
    $innerEdge = [double]$object.position[2] + ([double]$object.scale[2] / 2.0)
    $object.scale[2] = $innerEdge + 2.56
    $object.position[2] = $innerEdge - ([double]$object.scale[2] / 2.0)
  }
}

# Let the four main timber house corners enter the top masonry course slightly.
# Preserve their upper ends so the roof and upper rails stay aligned.
foreach ($object in $kept) {
  if ($object.name -match '^Upper storey corner post ') {
    $topEdge = [double]$object.position[1] + ([double]$object.scale[1] / 2.0)
    $bottomEdge = 2.62
    $object.scale[1] = $topEdge - $bottomEdge
    $object.position[1] = $bottomEdge + ([double]$object.scale[1] / 2.0)
  }
}

# Double the lower timber ring downward while keeping its top at y=2.99.
# The raised exposed joist ends now terminate inside this heavier ring.
foreach ($object in $kept) {
  if ($object.name -match '^(Front|Rear|Left gable|Right gable) horizontal timber 3\.03$') {
    $object.position[1] = 2.79
    $object.scale[1] = 0.40
    if ($object.name -match '^(Left gable|Right gable) ') {
      # Carry the short-side sill through both long-side beams so the four
      # pieces form one continuous structural timber ring at the corners. Its
      # outer face sits just beyond the stone but inside the corner-post face.
      $object.position[0] = if ($object.name -match '^Left gable ') { -3.94 } else { 3.94 }
      $object.position[2] = 0.0
      $object.scale[2] = 5.57
    }
  }
}

# Add a recessed cement/mortar backing behind the visible stone courses.  The
# original textured inner walls remain untouched for the cellar interior.
$mortarSpecs = @(
  @{ Source = 'Front inner basement wall left';  Name = 'Front mortar backing left';  Axis = 2; Position =  2.70; X = -2.450; SX = 3.14 },
  @{ Source = 'Front inner basement wall right'; Name = 'Front mortar backing right'; Axis = 2; Position =  2.70; X =  2.450; SX = 3.14 },
  @{ Source = 'Rear inner basement wall left';   Name = 'Rear mortar backing left';   Axis = 2; Position = -2.70; X = -1.325; SX = 5.39 },
  @{ Source = 'Rear inner basement wall right';  Name = 'Rear mortar backing right';  Axis = 2; Position = -2.70; X =  3.575; SX = 0.89 },
  @{ Source = 'Left inner basement wall';        Name = 'Left mortar backing';        Axis = 0; Position = -4.00; Z = 0.0; SZ = 5.44 },
  @{ Source = 'Right inner basement wall';       Name = 'Right mortar backing';       Axis = 0; Position =  4.00; Z = 0.0; SZ = 5.44 }
)
foreach ($spec in $mortarSpecs) {
  $sourceWall = $kept | Where-Object { $_.name -eq $spec.Source } | Select-Object -First 1
  if (-not $sourceWall) { continue }
  $backing = $sourceWall | ConvertTo-Json -Depth 40 | ConvertFrom-Json
  $slug = ($spec.Name.ToLowerInvariant() -replace '[^a-z0-9]+', '-')
  $backing.id = "generated-$slug"
  $backing.name = $spec.Name
  $backing.position[$spec.Axis] = [double]$spec.Position
  $backing.scale[$spec.Axis] = 0.04
  if ($spec.ContainsKey('X')) {
    $backing.position[0] = [double]$spec.X
    $backing.scale[0] = [double]$spec.SX
  }
  if ($spec.ContainsKey('Z')) {
    $backing.position[2] = [double]$spec.Z
    $backing.scale[2] = [double]$spec.SZ
  }
  $backing.color = '#51534F'
  $backing.roughness = 1.0
  $backing.textureUrl = $null
  $backing.textureName = $null
  $backing.textureRobloxAssetId = ''
  $backing.groupId = 'mortar-backing'
  $backing.groupName = 'Recessed Cement Mortar Backing'
  $kept.Add($backing)
}

# A compact cast-iron stove on the upper floor, aligned directly below the
# existing chimney.  The vertical flue overlaps both the stove collar and the
# chimney base, making the connection continuous from the room to the stack.
$stoveSpecs = @(
  @{ Source = 'Chimney main stack'; Name = 'Cast iron stove body';             X = 2.35; Y = 3.39; Z = -0.72; SX = 0.82; SY = 1.02; SZ = 0.68; Color = '#171817'; Rough = 0.82; Rotate = $true },
  @{ Source = 'Chimney main stack'; Name = 'Cast iron stove base plinth';      X = 2.35; Y = 2.86; Z = -0.72; SX = 0.90; SY = 0.14; SZ = 0.74; Color = '#111211'; Rough = 0.88; Rotate = $true },
  @{ Source = 'Chimney main stack'; Name = 'Cast iron stove top plate';        X = 2.35; Y = 3.93; Z = -0.72; SX = 0.94; SY = 0.08; SZ = 0.78; Color = '#202120'; Rough = 0.78; Rotate = $true },
  @{ Source = 'Chimney main stack'; Name = 'Cast iron stove firebox door';     X = 2.35; Y = 3.43; Z = -0.355; SX = 0.62; SY = 0.62; SZ = 0.07; Color = '#0C0D0C'; Rough = 0.86; Rotate = $true },
  @{ Source = 'Chimney main stack'; Name = 'Cast iron stove ember window';     X = 2.35; Y = 3.43; Z = -0.315; SX = 0.46; SY = 0.40; SZ = 0.035; Color = '#7A2B12'; Rough = 0.58; Rotate = $true },
  @{ Source = 'Chimney main stack'; Name = 'Cast iron stove lower air vent';   X = 2.35; Y = 3.08; Z = -0.305; SX = 0.44; SY = 0.08; SZ = 0.04; Color = '#080908'; Rough = 0.90; Rotate = $true },
  @{ Source = 'Chimney main stack'; Name = 'Cast iron stove door handle';      X = 2.62; Y = 3.52; Z = -0.275; SX = 0.16; SY = 0.05; SZ = 0.05; Color = '#B08B45'; Rough = 0.62; Rotate = $true },
  @{ Source = 'Ridge cap 1'; Name = 'Cast iron stove flue collar'; X = 2.35; Y = 4.02; Z = -0.72; SX = 0.40; SY = 0.18; SZ = 0.40; Color = '#151615'; Rough = 0.84; Rotate = $false },
  @{ Source = 'Ridge cap 1'; Name = 'Cast iron stove flue pipe';   X = 2.35; Y = 5.42; Z = -0.72; SX = 0.28; SY = 2.72; SZ = 0.28; Color = '#111211'; Rough = 0.80; Rotate = $false },
  @{ Source = 'Chimney main stack'; Name = 'Cast iron stove chimney sleeve';   X = 2.35; Y = 6.76; Z = -0.72; SX = 0.46; SY = 0.18; SZ = 0.46; Color = '#1A1B1A'; Rough = 0.86; Rotate = $false }
)
foreach ($spec in $stoveSpecs) {
  $sourcePart = $kept | Where-Object { $_.name -eq $spec.Source } | Select-Object -First 1
  if (-not $sourcePart) { continue }
  $part = $sourcePart | ConvertTo-Json -Depth 40 | ConvertFrom-Json
  $slug = ($spec.Name.ToLowerInvariant() -replace '[^a-z0-9]+', '-')
  $part.id = "generated-$slug"
  $part.name = $spec.Name
  $partX = [double]$spec.X
  $partZ = [double]$spec.Z
  $rotationY = 0.0
  if ($spec.Rotate) {
    # Turn the firebox 90 degrees left from its previous 45-degree orientation
    # while the round vertical flue remains centred below the fixed chimney.
    $angle = -[Math]::PI / 4.0
    $offsetX = $partX - 2.35
    $offsetZ = $partZ + 0.72
    $partX = 2.35 + ($offsetX * [Math]::Cos($angle)) + ($offsetZ * [Math]::Sin($angle))
    $partZ = -0.72 - ($offsetX * [Math]::Sin($angle)) + ($offsetZ * [Math]::Cos($angle))
    $rotationY = -45.0
  }
  $part.position = @($partX, [double]$spec.Y, $partZ)
  $part.rotation = @(0.0, $rotationY, 0.0)
  $part.scale = @([double]$spec.SX, [double]$spec.SY, [double]$spec.SZ)
  $part.color = [string]$spec.Color
  $part.roughness = [double]$spec.Rough
  $part.textureUrl = $null
  $part.textureName = $null
  $part.textureRobloxAssetId = ''
  $part.groupId = 'cast-iron-stove'
  $part.groupName = 'Cast Iron Stove and Flue'
  $part.hidden = $false
  $kept.Add($part)
}

# Exposed interior roof structure. Five repeated trusses sit just beneath the
# roof skin: paired sloping rafters carry each pitch and a compact collar tie
# braces the pair high in the room without closing off the open upper floor.
$roofBeamTemplate = $kept | Where-Object { $_.name -eq 'Heavy oak ridge beam' } | Select-Object -First 1
if ($roofBeamTemplate) {
  $trussStations = @(-3.2, -1.6, 0.0, 1.6, 3.2)
  foreach ($station in $trussStations) {
    $stationSlug = ([string]$station).Replace('-', 'm').Replace('.', 'p')
    $roofBeamSpecs = @(
      @{ Name = "Interior front roof rafter $station"; X = $station; Y = 7.28; Z = 1.25;  RX = -42.484; SX = 0.22; SY = 3.78; SZ = 0.18 },
      @{ Name = "Interior rear roof rafter $station";  X = $station; Y = 7.28; Z = -1.25; RX = 42.484;  SX = 0.22; SY = 3.78; SZ = 0.18 },
      @{ Name = "Interior roof collar tie $station";   X = $station; Y = 7.48; Z = 0.0;   RX = 0.0;     SX = 0.24; SY = 0.22; SZ = 2.62 }
    )
    foreach ($beamSpec in $roofBeamSpecs) {
      $beam = $roofBeamTemplate | ConvertTo-Json -Depth 40 | ConvertFrom-Json
      $beamSlug = ($beamSpec.Name.ToLowerInvariant() -replace '[^a-z0-9]+', '-')
      $beam.id = "generated-$beamSlug-$stationSlug"
      $beam.name = $beamSpec.Name
      $beam.position = @([double]$beamSpec.X, [double]$beamSpec.Y, [double]$beamSpec.Z)
      $beam.rotation = @([double]$beamSpec.RX, 0.0, 0.0)
      $beam.scale = @([double]$beamSpec.SX, [double]$beamSpec.SY, [double]$beamSpec.SZ)
      $beam.color = '#34251F'
      $beam.roughness = 0.96
      $beam.textureUrl = $null
      $beam.textureName = $null
      $beam.textureRobloxAssetId = ''
      $beam.groupId = 'interior-roof-frame'
      $beam.groupName = 'Interior Roof Beams'
      $beam.hidden = $false
      $kept.Add($beam)
    }
  }
}

# A separate finished floor raises the walkable surface to y=2.79 and keeps
# the stairwell opening intact.  Its embedded texture runs from right to left.
$floorSpecs = @(
  @{ Source = 'Upper floor main deck';        Name = 'Finished aged oak plank floor main';        X =  0.65; Z = 0.00; SX = 6.00; SZ = 4.72 },
  @{ Source = 'Upper floor stair entry deck'; Name = 'Finished aged oak plank floor stair entry'; X = -3.00; Z = 1.98; SX = 1.30; SZ = 0.76 }
)
foreach ($spec in $floorSpecs) {
  $sourceFloor = $kept | Where-Object { $_.name -eq $spec.Source } | Select-Object -First 1
  if (-not $sourceFloor) { continue }
  $finish = $sourceFloor | ConvertTo-Json -Depth 40 | ConvertFrom-Json
  $slug = ($spec.Name.ToLowerInvariant() -replace '[^a-z0-9]+', '-')
  $finish.id = "generated-$slug"
  $finish.name = $spec.Name
  # Extend the finish slightly beneath the inner plaster faces.  The two-piece
  # layout still leaves the L-shaped stairwell opening completely unobstructed.
  $finish.position[0] = [double]$spec.X
  $finish.position[1] = 2.755
  $finish.position[2] = [double]$spec.Z
  $finish.scale[0] = [double]$spec.SX
  $finish.scale[1] = 0.07
  $finish.scale[2] = [double]$spec.SZ
  $finish.color = '#FFFFFF'
  $finish.roughness = 0.92
  $finish.textureUrl = $null
  $finish.textureName = 'Aged Wide Oak Floorboards'
  $finish.textureRobloxAssetId = ''
  $finish.textureFlipY = $true
  $finish.textureRotation = 0
  $finish.groupId = 'upper-floor-finish'
  $finish.groupName = 'Finished Upper Floor'
  $kept.Add($finish)
}

$woodTextureName = 'Hand-Hewn Dark Oak Timber'
$ironTextureName = 'Hammered Black Iron'

# Material pass: wood keeps a coherent timber language throughout the house,
# while forged hardware receives its own metal surface. Glass, stone, plaster,
# mortar and roof tiles remain untouched.
foreach ($object in $kept) {
  $name = [string]$object.name
  $groupId = [string]$object.groupId
  $isIron = ($name -match '(?i)(iron|ring handle|center lead|lattice)') -or
    (($groupId -eq 'cast-iron-stove') -and ($name -notmatch '(?i)(ember window|door handle)'))
  $isWood = ($groupId -in @('timber', 'interior-roof-frame', 'basement-furnishings')) -or
    (($groupId -eq 'details') -and ($name -match '(?i)(joist|oak|timber|wood)')) -or
    (($groupId -eq 'roof') -and ($name -match '(?i)(oak|beam|eave)')) -or
    (($groupId -eq 'interior') -and ($name -match '(?i)(floor|deck|tread|landing|post|rail)')) -or
    (($groupId -eq 'doors') -and ($name -notmatch '(?i)(recess|iron|ring handle)')) -or
    (($groupId -eq 'windows') -and ($name -match '(?i)(jamb|lintel|sill)'))
  if ($isIron) {
    $object.color = '#FFFFFF'
    $object.roughness = 0.76
    $object.textureUrl = $null
    $object.textureName = $ironTextureName
    $object.textureRobloxAssetId = ''
    $object.textureFlipY = $true
    $object.textureRotation = 0
  } elseif ($isWood -and ($object.textureName -ne 'Aged Wide Oak Floorboards')) {
    $object.color = '#FFFFFF'
    $object.roughness = 0.94
    $object.textureUrl = $null
    $object.textureName = $woodTextureName
    $object.textureRobloxAssetId = ''
    $object.textureFlipY = $true
    $object.textureRotation = 0
  }
}

$otherTextures = @($project.textureLibrary | Where-Object { $_.name -notin @('Aged Wide Oak Floorboards', $woodTextureName, $ironTextureName) })
$floorTexture = [pscustomobject]@{
  name = 'Aged Wide Oak Floorboards'
  dataUrl = $floorTextureDataUrl
  robloxAssetId = ''
}
$beamTexture = [pscustomobject]@{ name = $woodTextureName; dataUrl = $beamTextureDataUrl; robloxAssetId = '' }
$ironTexture = [pscustomobject]@{ name = $ironTextureName; dataUrl = $ironTextureDataUrl; robloxAssetId = '' }
$project.textureLibrary = @($otherTextures + $floorTexture + $beamTexture + $ironTexture)

# Seed useful director cameras for visual QA and interior navigation. The studio
# keeps these as editor helpers, so they never become exported building meshes.
if (-not $project.editor) {
  $project | Add-Member -NotePropertyName editor -NotePropertyValue ([pscustomobject]@{}) -Force
}
$cameraViews = [pscustomobject]@{
  selectedId = 'camera-director-1'
  showMarkers = $true
  views = @(
    [pscustomobject]@{ id = 'camera-director-1'; name = 'Exterior Courtyard'; position = @(10.5, 5.4, 12.0); target = @(0.0, 4.2, 0.0); up = @(0.0, 1.0, 0.0); fov = 55.0 },
    [pscustomobject]@{ id = 'camera-director-2'; name = 'Upper Hall'; position = @(0.0, 4.75, -1.65); target = @(0.0, 5.65, 2.15); up = @(0.0, 1.0, 0.0); fov = 62.0 },
    [pscustomobject]@{ id = 'camera-director-3'; name = 'Cellar'; position = @(0.0, 1.35, 1.65); target = @(0.0, 1.25, -1.65); up = @(0.0, 1.0, 0.0); fov = 60.0 },
    [pscustomobject]@{ id = 'camera-director-4'; name = 'Upper Hall Player View'; type = 'player'; anchorBoneId = 'player-head-upper-hall'; position = @(0.0, 4.75, -1.65); target = @(0.0, 4.75, -0.65); up = @(0.0, 1.0, 0.0); fov = 62.0; positionOffset = @(0.0, 0.0, 0.0); localDirection = @(0.0, 0.0, 1.0); localUp = @(0.0, 1.0, 0.0) }
  )
}
$project.editor | Add-Member -NotePropertyName cameraViews -NotePropertyValue $cameraViews -Force
$playerRig = [pscustomobject]@{
  selectedBoneId = 'player-head-upper-hall'
  showGuides = $true
  bones = @(
    [pscustomobject]@{ id = 'player-head-upper-hall'; name = 'Player Head - Upper Hall'; parentId = $null; role = 'camera'; position = @(0.0, 4.75, -1.65); rotation = @(0.0, 0.0, 0.0) }
  )
}
$project.editor | Add-Member -NotePropertyName rigging -NotePropertyValue $playerRig -Force
if (-not $project.editor.panels) {
  $project.editor | Add-Member -NotePropertyName panels -NotePropertyValue ([pscustomobject]@{}) -Force
}
$project.editor.panels | Add-Member -NotePropertyName cameraViewsCollapsed -NotePropertyValue $false -Force

# Register every generated component group in the persistent hierarchy. Object
# groupName values alone are not enough for AI validation or nested exports.
$requiredGroups = @(
  [pscustomobject]@{ id = 'mortar-backing'; name = 'Recessed Cement Mortar Backing'; parentId = 'foundation' },
  [pscustomobject]@{ id = 'cast-iron-stove'; name = 'Cast Iron Stove and Flue'; parentId = 'interior' },
  [pscustomobject]@{ id = 'interior-roof-frame'; name = 'Interior Roof Beams'; parentId = 'interior' },
  [pscustomobject]@{ id = 'upper-floor-finish'; name = 'Finished Upper Floor'; parentId = 'interior' }
)
$sceneGroups = [System.Collections.Generic.List[object]]::new()
foreach ($group in @($project.scene.groups)) { $sceneGroups.Add($group) }
foreach ($requiredGroup in $requiredGroups) {
  $existingGroup = $sceneGroups | Where-Object { $_.id -eq $requiredGroup.id } | Select-Object -First 1
  if ($existingGroup) {
    $existingGroup.name = $requiredGroup.name
    $existingGroup.parentId = $requiredGroup.parentId
  } else {
    $sceneGroups.Add($requiredGroup)
  }
}
$project.scene.groups = $sceneGroups.ToArray()

$project.scene.objects = $kept.ToArray()
$project.name = 'blackstone-timber-manor_stenar'
$json = $project | ConvertTo-Json -Depth 60
[System.IO.File]::WriteAllText($Destination, $json, [System.Text.UTF8Encoding]::new($false))
