import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  FlatList,
  ActivityIndicator,
  Linking,
  RefreshControl,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Palette, Typography, useThemeColors } from '../../constants/theme';
import { creditService, alertsService, procurementService } from '../../services/api';
import { BlurView } from 'expo-blur';

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

      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View style={styles.categoryPillContainer}>
          {categories.map((cat) => (
            <TouchableOpacity 
              key={cat.id}
              style={[styles.categoryItem, activeCategory === cat.id && styles.categoryItemActive]}
              onPress={() => setActiveCategory(cat.id as Category)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={cat.icon as any} 
                size={16} 
                color={activeCategory === cat.id ? '#FFF' : Colors.textSecondary} 
              />
              {activeCategory === cat.id && (
                <Text style={styles.categoryLabelActive}>
                  {cat.label}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingRight: 40 }}>
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
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="card-outline" size={48} color={Colors.primary} />
              </View>
              <Text style={styles.emptyText}>Nenhuma oferta no momento</Text>
              <Text style={styles.emptySubText}>Tente ajustar os filtros ou retorne mais tarde.</Text>
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
    
    const items = result?.data || result || [];
    setTenders(Array.isArray(items) ? items : []);
    setTotalPages(result?.totalPaginas || 1);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(page);
    }, [page, loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadData(1);
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch { return dateStr; }
  };

  const formatCurrency = (value: number) => {
    try {
      return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    } catch { return `R$ ${value}`; }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.paginationRow}>
        <TouchableOpacity 
          style={[styles.pageBtn, page <= 1 && { opacity: 0.3 }]} 
          onPress={() => page > 1 && setPage(p => p - 1)} 
          disabled={page <= 1}
        >
          <Ionicons name="chevron-back" size={18} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.pageInfoBadge}>
          <Text style={styles.pageInfo}>Página {page} de {totalPages}</Text>
        </View>
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
                <View style={[styles.bankLogo, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <Ionicons name="business" size={24} color="#F59E0B" />
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.footerLabel}>Valor Est.</Text>
                  <Text style={styles.footerValue}>
                    {item?.valorTotalEstimado ? formatCurrency(item.valorTotalEstimado) : 'N/I'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
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
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="search-outline" size={48} color={Colors.primary} />
              </View>
              <Text style={styles.emptyText}>Nenhuma licitação encontrada</Text>
              <Text style={styles.emptySubText}>Tente buscar novamente em alguns minutos.</Text>
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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'Crítica': return '#EF4444';
      case 'Alta': return '#F59E0B';
      case 'Média': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingRight: 40 }}>
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={styles.newsTitle}>{item.title}</Text>
                </View>
                {item.summary ? <Text style={styles.newsSummary} numberOfLines={2}>{item.summary}</Text> : null}
                <View style={styles.newsFooter}>
                  <View style={styles.newsSourcePill}>
                    <Text style={styles.newsSource}>{item.source || 'Governo'}</Text>
                  </View>
                  <Text style={styles.newsDate}>
                    {item.published_at ? new Date(item.published_at).toLocaleDateString('pt-BR') : 'Hoje'}
                  </Text>
                  <View style={[styles.impactBadge, { backgroundColor: `${getImpactColor(item.impact)}20` }]}>
                    <Text style={[styles.newsImpact, { color: getImpactColor(item.impact) }]}>
                      {item.impact}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="newspaper-outline" size={48} color={Colors.primary} />
              </View>
              <Text style={styles.emptyText}>Nenhuma novidade radar</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const getStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.black },
  header: { paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 24 },
  headerTitle: { fontSize: 32, fontFamily: Typography.fonts.display, color: Colors.text, letterSpacing: -0.5 },

  categoryPillContainer: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 24, 
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  categoryItem: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    borderRadius: 18, 
    gap: 8,
  },
  categoryItemActive: { 
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryLabelActive: { color: '#FFF', fontSize: 13, fontFamily: Typography.fonts.display },

  filterRow: { paddingLeft: 20, paddingVertical: 12, maxHeight: 60 },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginRight: 10 },
  chipActive: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: Colors.primary },
  chipText: { color: Colors.textMuted, fontSize: 13, fontFamily: Typography.fonts.medium },
  chipTextActive: { color: Colors.text },

  content: { padding: 20, paddingBottom: 120 },

  opportunityCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  bankLogo: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontFamily: Typography.fonts.display, color: Colors.text, lineHeight: 22, paddingRight: 8 },
  cardSub: { fontSize: 13, color: Colors.textSecondary, fontFamily: Typography.fonts.medium, marginTop: 4 },
  cardDescription: { fontSize: 13, color: Colors.textMuted, fontFamily: Typography.fonts.body, lineHeight: 20, marginBottom: 16 },
  badge: { backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-start' },
  badgeText: { color: '#10B981', fontSize: 12, fontFamily: Typography.fonts.display },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 16, gap: 12 },
  footerLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', fontFamily: Typography.fonts.medium, letterSpacing: 0.5 },
  footerValue: { fontSize: 14, fontFamily: Typography.fonts.display, color: Colors.text, marginTop: 4 },
  applyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14 },
  applyBtnText: { color: '#FFF', fontSize: 13, fontFamily: Typography.fonts.display },

  modalityBadge: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexShrink: 1 },
  modalityText: { color: Colors.text, fontSize: 10, fontFamily: Typography.fonts.display },

  paginationRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, gap: 16 },
  pageBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  pageInfoBadge: { backgroundColor: 'rgba(255,255,255,0.02)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  pageInfo: { color: Colors.text, fontSize: 13, fontFamily: Typography.fonts.medium },

  newsCard: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 24, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  impactIndicator: { width: 4, borderRadius: 2, marginRight: 16 },
  newsContent: { flex: 1, paddingVertical: 4 },
  newsTitle: { fontSize: 15, fontFamily: Typography.fonts.display, color: Colors.text, lineHeight: 22, paddingRight: 10 },
  newsSummary: { fontSize: 13, color: Colors.textMuted, fontFamily: Typography.fonts.body, marginTop: 6, lineHeight: 18 },
  newsFooter: { flexDirection: 'row', marginTop: 14, alignItems: 'center', gap: 10 },
  newsDate: { fontSize: 12, color: Colors.textMuted, fontFamily: Typography.fonts.medium },
  newsSourcePill: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  newsSource: { fontSize: 10, color: Colors.textSecondary, fontFamily: Typography.fonts.display },
  impactBadge: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  newsImpact: { fontSize: 10, fontFamily: Typography.fonts.display },

  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyIconWrapper: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyText: { color: Colors.text, fontSize: 18, fontFamily: Typography.fonts.display, textAlign: 'center' },
  emptySubText: { color: Colors.textMuted, marginTop: 8, fontSize: 14, fontFamily: Typography.fonts.body, textAlign: 'center', lineHeight: 22 },
});
