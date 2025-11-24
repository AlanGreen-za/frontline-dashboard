# Fix manager filter
s/filterState\.selectedManager(?!s)/filterState.selectedManagers.includes(manager)/g
s/\[outline\]="filterState\.selectedManagers\.includes\(manager\) !== manager"/[outline]="!filterState.selectedManagers.includes(manager)"/g
s/\[color\]="filterState\.selectedManagers\.includes\(manager\) === manager \? 'primary' : 'medium'"//g
s/onManagerChange\(\{detail: \{value: manager\}\}\)/onManagerChange(manager)/g
s/\*ngIf="filterState\.selectedManagers\.includes\(manager\) !== manager"/*ngIf="!filterState.selectedManagers.includes(manager)"/g

# Fix region filter
s/filterState\.selectedRegion(?!s)/filterState.selectedRegions/g
s/onRegionChange\(\$event\)/onRegionChange($event.detail.value)/g

# Fix province filter
s/filterState\.selectedProvince(?!s)/filterState.selectedProvinces.includes(province)/g
s/\[outline\]="filterState\.selectedProvinces\.includes\(province\) !== province"/[outline]="!filterState.selectedProvinces.includes(province)"/g
s/\[color\]="filterState\.selectedProvinces\.includes\(province\) === province \? 'primary' : 'medium'"//g
s/onProvinceChange\(\{detail: \{value: province\}\}\)/onProvinceChange(province)/g
s/\*ngIf="filterState\.selectedProvinces\.includes\(province\) !== province"/*ngIf="!filterState.selectedProvinces.includes(province)"/g
