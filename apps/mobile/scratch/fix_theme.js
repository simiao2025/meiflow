const fs = require('fs');
const path = require('path');

const filesToFix = [
  'app/(tabs)/opportunities.tsx',
  'app/(tabs)/clients.tsx',
  'app/(tabs)/catalog.tsx',
  'app/(tabs)/pos.tsx',
  'app/(tabs)/schedule.tsx',
  'app/(tabs)/assistant.tsx',
  'app/finance/reconciliation.tsx',
  'app/finance/sync.tsx',
  'app/fiscal/export.tsx',
  'app/fiscal/invoices.tsx',
  'app/map.tsx',
  'app/auth/login.tsx',
];

for (const relPath of filesToFix) {
  const filePath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${relPath} - not found`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Fix the import
  // Replace `import { Colors, ... }` or `import { ..., Colors, ... }` with `useThemeColors`
  // Actually simpler: just add useThemeColors to the import list if not there, and remove Colors
  if (content.includes('import { Colors')) {
    content = content.replace(/import\s*\{\s*([^}]*?)\s*\}\s*from\s*['"](.*?)constants\/theme['"];?/, (match, group1, group2) => {
      let imports = group1.split(',').map(s => s.trim()).filter(s => s !== 'Colors' && s !== 'Colors as StaticColors');
      if (!imports.includes('useThemeColors')) {
        imports.push('useThemeColors');
      }
      return `import { ${imports.join(', ')} } from '${group2}constants/theme';`;
    });
  } else if (content.match(/import\s*\{[^}]*?Colors[^}]*?\}\s*from/)) {
    // If it's somewhere in the middle
    content = content.replace(/import\s*\{\s*([^}]*?)\s*\}\s*from\s*['"](.*?)constants\/theme['"];?/, (match, group1, group2) => {
      let imports = group1.split(',').map(s => s.trim()).filter(s => s !== 'Colors' && s !== 'Colors as StaticColors');
      if (!imports.includes('useThemeColors')) {
        imports.push('useThemeColors');
      }
      return `import { ${imports.join(', ')} } from '${group2}constants/theme';`;
    });
  }

  // 2. Replace const styles = StyleSheet.create({ with const getStyles = (Colors: any) => StyleSheet.create({
  if (content.includes('const styles = StyleSheet.create({')) {
    content = content.replace('const styles = StyleSheet.create({', 'const getStyles = (Colors: any) => StyleSheet.create({');
  }

  // 3. Inject `const Colors = useThemeColors(); const styles = getStyles(Colors);` into every functional component that returns JSX
  // We look for function declarations like `export default function ...() {` or `function ...() {`
  content = content.replace(/(export default function \w+\([^)]*\)\s*\{|function \w+\([^)]*\)\s*\{)/g, (match) => {
    return `${match}\n  const Colors = useThemeColors();\n  const styles = getStyles(Colors);`;
  });

  // For arrow functions: `const MyComponent = () => {`
  content = content.replace(/(const \w+\s*=\s*\([^)]*\)\s*=>\s*\{)/g, (match) => {
    return `${match}\n  const Colors = useThemeColors();\n  const styles = getStyles(Colors);`;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed ${relPath}`);
}
