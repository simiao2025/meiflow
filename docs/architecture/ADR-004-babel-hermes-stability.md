# ADR-004: Estabilidade de Runtime (Babel, Hermes e React Compiler)

## Status
Aceito

## Contexto
Durante o desenvolvimento e testes em dispositivos físicos (Android/iOS) com o motor **Hermes**, identificamos um erro crítico de runtime: `TypeError: Cannot assign to read-only property 'NONE' of object '#<Object>'`.

Esse erro impedia a inicialização do aplicativo e estava relacionado a conflitos entre o **React Compiler (2026)** e bibliotecas que utilizam injeção de propriedades em tempo de execução ou decoradores (como `react-native-reanimated` e `WatermelonDB`). Além disso, o uso de adaptadores de banco de dados baseados em memória (LokiJS) no mobile apresentava instabilidades.

## Decisão
Decidimos pelas seguintes alterações na configuração de build e runtime:

1. **Desativação do React Compiler:** Desativamos explicitamente o `reactCompiler` no preset `babel-preset-expo`. Embora ofereça otimizações de performance, o compilador "congela" componentes de forma incompatível com o ecossistema atual de animações e decoradores.
2. **Padronização do Babel:** Removemos a declaração manual de plugins como `@babel/plugin-transform-class-properties` em favor do gerenciamento automático pelo preset da Expo, evitando conflitos de `loose` mode entre diferentes plugins.
3. **SQLite Nativo com JSI:** Forçamos o uso do `SQLiteAdapter` no mobile (com JSI habilitado) em vez do `LokiJSAdapter`. O SQLite é thread-safe e mais estável no ambiente Hermes.

## Consequências

### Positivas
- **Estabilidade Total:** Eliminação do crash `NONE` no boot do app.
- **Performance de Dados:** O uso de JSI com SQLite proporciona latência mínima em operações de banco de dados.
- **Manutenibilidade:** Configuração de Babel mais limpa e menos propensa a erros de colisão de transformações.

### Negativas
- **Otimizações Perdidas:** Não utilizaremos as otimizações automáticas de memoization do React Compiler por enquanto.
- **Complexidade de Sync:** O SQLite exige mais cuidado com migrações de esquema do que o LokiJS.

## Alternativas Consideradas
- **Patch de Bibliotecas:** Tentar patchear o `reanimated` para evitar o uso da propriedade `NONE`, porém isso criaria uma dívida técnica difícil de manter.
- **Desativar Hermes:** Mudar para o motor JSC resolveria o problema, mas sacrificaríamos a performance e o tempo de boot significativamente.
