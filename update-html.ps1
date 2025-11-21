$content = Get-Content "src/app/components/dashboard/dashboard.component.html" -Raw

# Update manager badges
$content = $content -replace '(<ion-badge \*ngIf="filterState\.selectedManager !== manager" color="light">)12(</ion-badge>)', '$1{{ (managerCounts$ | async)?.get(manager) || 0 }}$2'

# Add color to province chips and add badges
$content = $content -replace '(<ion-chip \*ngFor="let province of provinces\$ \| async" \[outline\]="filterState\.selectedProvince !== province")\s+(\(click\)="onProvinceChange\(\{detail: \{value: province\}\}\)">)', '$1`r`n              [color]="filterState.selectedProvince === province ? ''primary'' : ''medium''"`r`n              $2`r`n              <ion-badge *ngIf="filterState.selectedProvince !== province" color="light">{{ (provinceCounts$ | async)?.get(province) || 0 }}</ion-badge>'

Set-Content "src/app/components/dashboard/dashboard.component.html" -Value $content -NoNewline
