import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  FlatList,
  Dimensions,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Typography, useThemeColors } from '../../constants/theme';
import { creditService, alertsService, procurementService } from '../../services/api';

const { width } = Dimensions.get('window');

type Category = 'credit' | 'procurement' | 'legal';

export default function OpportunitiesScreen() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const [activeCategory, setActiveCategory] = useState<Category>('credit');

  const categories = [
    { id: 'credit', label: 'Crédito', icon: 'card-outline' },
    { id: 'procurement', label: 'Licitações', icon: 'business-outline' },
    { id: 'legal', label: 'Radar do MEI', icon: 'newspaper-outline' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Oportunidades</Text>
      </View>

      <View style={styles.categoryBar}>
        {categories.map((cat) => (
          <TouchableOpacity 
            key={cat.id}
            style={[styles.categoryItem, activeCategory === cat.id && styles.categoryItemActive]}
            onPress={() => setActiveCategory(cat.id as Category)}
          >
            <Ionicons 
              name={cat.icon as any} 
              size={20} 
              color={activeCategory === cat.id ? '#FFF' : Colors.textSecondary} 
            />
            <Text style={[styles.categoryLabel, activeCategory === cat.id && styles.categoryLabelActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeCategory === 'credit' && <CreditSection />}
      {activeCategory === 'procurement' && <ProcurementSection />}
      {activeCategory === 'legal' && <LegalSection />}
    </View>
  );
}

// ─────────────────────────────────────────────────────
// CRÉDITO
// ─────────────────────────────────────────────────────
function CreditSection() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos');
  const [refreshing, setRefreshing] = useState(false);

  const filters = [
    { key: 'todos', label: 'Todos' },
    { key: 'giro', label: 'Capital de Giro' },
    { key: 'cartao', label: 'Cartão' },
    { key: 'antecipacao', label: 'Antecipação' },
    { key: 'investimento', label: 'Investimento' },
  ];

  const loadData = useCallback(async (cat?: string) => {
    setLoading(true);
    const data = await creditService.getOffers(cat || filter);
    setOffers(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadData(); }, [filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingRight: 24 }}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.opportunityCard} activeOpacity={0.8} onPress={() => item.url && Linking.openURL(item.url)}>
              <View style={styles.cardHeader}>
                <View style={styles.bankLogo}>
                  <Ionicons name="business" size={24} color={Colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSub}>{item.bank_name}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.match_score}% Match</Text>
                </View>
              </View>
              {item.description ? <Text style={styles.cardDescription}>{item.description}</Text> : null}
              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.footerLabel}>Taxa</Text>
                  <Text style={styles.footerValue}>{item.rate || '—'}</Text>
                </View>
                <View>
                  <Text style={styles.footerLabel}>Disponível</Text>
                  <Text style={styles.footerValue}>{item.max_amount || '—'}</Text>
                </View>
                <TouchableOpacity style={styles.applyBtn} onPress={() => item.url && Linking.openURL(item.url)}>
                  <Text style={styles.applyBtnText}>Simular</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Nenhuma oferta de crédito encontrada.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────
// LICITAÇÕES (PNCP)
// ─────────────────────────────────────────────────────
function ProcurementSection() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = useCallback(async (pg = 1) => {
    setLoading(true);
    const result = await procurementService.getTenders(pg);
    
    // A API PNCP pode retornar formatos variados, vamos tratar
    const items = result?.data || result || [];
    setTenders(Array.isArray(items) ? items : []);
    setTotalPages(result?.totalPaginas || 1);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(page); }, [page]);

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadData(1);
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch { return dateStr; }
  };

  const formatCurrency = (value: number) => {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
    try {
      return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    } catch { return `R$ ${value}`; }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Paginação */}
      <View style={styles.paginationRow}>
        <TouchableOpacity 
          style={[styles.pageBtn, page <= 1 && { opacity: 0.3 }]} 
          onPress={() => page > 1 && setPage(p => p - 1)} 
          disabled={page <= 1}
        >
          <Ionicons name="chevron-back" size={18} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.pageInfo}>Página {page} de {totalPages}</Text>
        <TouchableOpacity 
          style={[styles.pageBtn, page >= totalPages && { opacity: 0.3 }]} 
          onPress={() => page < totalPages && setPage(p => p + 1)} 
          disabled={page >= totalPages}
        >
          <Ionicons name="chevron-forward" size={18} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={tenders}
          keyExtractor={(item, index) => item?.numeroControlePNCP || String(index)}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.opportunityCard} activeOpacity={0.8}>
              <View style={styles.cardHeader}>
                <View style={[styles.bankLogo, { backgroundColor: Colors.primaryMuted }]}>
                  <Ionicons name="document-text-outline" size={24} color={Colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item?.objetoCompra || item?.descricao || 'Licitação sem descrição'}
                  </Text>
                  <Text style={styles.cardSub} numberOfLines={1}>
                    {item?.orgaoEntidade?.razaoSocial || item?.nomeOrgao || 'Órgão não informado'}
                  </Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.footerLabel}>Valor Est.</Text>
                  <Text style={styles.footerValue}>
                    {item?.valorTotalEstimado ? formatCurrency(item.valorTotalEstimado) : 'N/I'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.footerLabel}>Publicação</Text>
                  <Text style={styles.footerValue}>
                    {item?.dataPublicacaoPncp ? formatDate(item.dataPublicacaoPncp) : '—'}
                  </Text>
                </View>
                <View style={[styles.modalityBadge]}>
                  <Text style={styles.modalityText} numberOfLines={1}>
                    {item?.modalidadeNome || item?.modalidade?.descricao || 'N/I'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Nenhuma licitação encontrada.</Text>
              <Text style={styles.emptySubText}>Verifique sua conexão com a internet.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────
// RADAR DO MEI
// ─────────────────────────────────────────────────────
function LegalSection() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos');
  const [refreshing, setRefreshing] = useState(false);

  const filters = [
    { key: 'todos', label: 'Todos' },
    { key: 'legislacao', label: '📜 Legislação' },
    { key: 'imposto', label: '💰 Impostos' },
    { key: 'beneficio', label: '🎁 Benefícios' },
    { key: 'prazo', label: '⏰ Prazos' },
  ];

  const loadData = useCallback(async (cat?: string) => {
    setLoading(true);
    const data = await alertsService.getAlerts(cat || filter);
    setNews(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadData(); }, [filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getImpactColor = (impact: string) => {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
    switch (impact) {
      case 'Crítica': return '#EF4444';
      case 'Alta': return '#F59E0B';
      case 'Média': return Colors.primaryLight;
      default: return '#6B7280';
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingRight: 24 }}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={news}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.newsCard} 
              activeOpacity={0.8}
              onPress={() => item.url && Linking.openURL(item.url)}
            >
              <View style={[styles.impactIndicator, { backgroundColor: getImpactColor(item.impact) }]} />
              <View style={styles.newsContent}>
                <Text style={styles.newsTitle}>{item.title}</Text>
                {item.summary ? <Text style={styles.newsSummary} numberOfLines={2}>{item.summary}</Text> : null}
                <View style={styles.newsFooter}>
                  <Text style={styles.newsDate}>
                    {item.published_at ? new Date(item.published_at).toLocaleDateString('pt-BR') : '—'}
                  </Text>
                  {item.source ? <Text style={styles.newsSource}>• {item.source}</Text> : null}
                  <Text style={[styles.newsImpact, { color: getImpactColor(item.impact) }]}>
                    {item.impact}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#475569" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons name="newspaper-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Nenhum alerta encontrado.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const getStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.black },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontFamily: Typography.fonts.display, color: Colors.text },

  categoryBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Palette.navyDeep, borderBottomWidth: 1, borderBottomColor: Palette.border },
  categoryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, marginHorizontal: 4 },
  categoryItemActive: { backgroundColor: Colors.primary },
  categoryLabel: { fontSize: 12, fontFamily: Typography.fonts.display, color: Colors.textSecondary, marginLeft: 6 },
  categoryLabelActive: { color: '#FFF' },

  filterRow: { paddingLeft: 24, paddingVertical: 16 },
  chip: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: '#334155', marginRight: 10 },
  chipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
  chipText: { color: Colors.textMuted, fontSize: 14, fontFamily: Typography.fonts.medium },
  chipTextActive: { color: Colors.text },

  content: { padding: 20, paddingBottom: 150 },

  opportunityCard: { backgroundColor: Palette.navyDeep, borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: Palette.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bankLogo: { width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.primaryMuted, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: Typography.fonts.display, color: Colors.text, lineHeight: 20 },
  cardSub: { fontSize: 13, color: Colors.textSecondary, fontFamily: Typography.fonts.medium, marginTop: 2 },
  cardDescription: { fontSize: 12, color: Colors.textMuted, fontFamily: Typography.fonts.medium, lineHeight: 18, marginBottom: 12 },
  badge: { backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#10B981', fontSize: 11, fontFamily: Typography.fonts.display },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Palette.border, paddingTop: 16 },
  footerLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', fontFamily: Typography.fonts.medium },
  footerValue: { fontSize: 13, fontFamily: Typography.fonts.display, color: Colors.text, marginTop: 2 },
  applyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  applyBtnText: { color: '#FFF', fontSize: 13, fontFamily: Typography.fonts.display },

  modalityBadge: { backgroundColor: Colors.primaryMuted, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, maxWidth: 120 },
  modalityText: { color: Colors.primary, fontSize: 10, fontFamily: Typography.fonts.display },

  paginationRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, gap: 16 },
  pageBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: Palette.navyDeep, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Palette.border },
  pageInfo: { color: Colors.textMuted, fontSize: 13, fontFamily: Typography.fonts.medium },

  newsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.navyDeep, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Palette.border },
  impactIndicator: { width: 4, height: '80%', minHeight: 40, borderRadius: 2, marginRight: 16 },
  newsContent: { flex: 1 },
  newsTitle: { fontSize: 14, fontFamily: Typography.fonts.display, color: Colors.text, lineHeight: 20 },
  newsSummary: { fontSize: 12, color: Colors.textMuted, fontFamily: Typography.fonts.medium, marginTop: 4, lineHeight: 16 },
  newsFooter: { flexDirection: 'row', marginTop: 8, alignItems: 'center', gap: 6 },
  newsDate: { fontSize: 11, color: Colors.textMuted, fontFamily: Typography.fonts.medium },
  newsSource: { fontSize: 11, color: Colors.textMuted, fontFamily: Typography.fonts.medium },
  newsImpact: { fontSize: 11, fontFamily: Typography.fonts.display, marginLeft: 'auto' },

  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: Colors.textMuted, marginTop: 12, fontSize: 14, fontFamily: Typography.fonts.medium },
  emptySubText: { color: Colors.textMuted, marginTop: 4, fontSize: 12, fontFamily: Typography.fonts.medium },
});
