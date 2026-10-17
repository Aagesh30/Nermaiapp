const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '..', 'web_portal', 'lms', 'admin', 'MobileLMSPages.tsx');
let content = fs.readFileSync(targetFile, 'utf8');
const isCrlf = content.includes('\r\n');
let norm = content.replace(/\r\n/g, '\n');

// Find the start of SACS return statement:
// return (
// <View style={{ gap: 14 }}>
//   {/* Header Card */}

const oldHeaderBlock = `        return (
        <View style={{ gap: 14 }}>
          {/* Header Card */}
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="shield-checkmark" size={22} color={themeRed} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pageTitle, { color: textPrimary }]}>Smart Access Control</Text>
                <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
                  Manage access requests and permissions.
                </Text>
              </View>
            </View>

            {/* Sub-tabs Horizontal Scrolling Pill Bar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 14 }}>
              {[
                { key: 'requests', label: 'Requests', count: sacsRequests.length, icon: 'time-outline' },
                { key: 'history', label: 'History', count: sacsHistory.length, icon: 'receipt-outline' },
                { key: 'permanent', label: 'Permanent', count: sacsPermanent.length, icon: 'lock-closed-outline' },
                { key: 'permissions', label: 'Rules', icon: 'shield-outline' },
              ].map((tab) => {
                const isActive = sacsSubTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setSacsSubTab(tab.key as any)}
                    style={[
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 10,
                        borderWidth: 1,
                        backgroundColor: isActive ? themeRed : inputBg,
                        borderColor: isActive ? themeRed : borderColor,
                      },
                    ]}
                  >
                    <Ionicons name={tab.icon as any} size={15} color={isActive ? '#fff' : textSecondary} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#fff' : textPrimary }}>
                      {tab.label}{tab.count !== undefined ? \` (\${tab.count})\` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Search Bar (visible on requests, history, permanent) */}
            {sacsSubTab !== 'permissions' && (
              <View style={[styles.searchBar, { backgroundColor: inputBg, borderColor, marginTop: 12 }]}>
                <Ionicons name="search" size={14} color={textSecondary} />
                <TextInput
                  placeholder="Search student, content, reason..."
                  placeholderTextColor={textSecondary}
                  value={sacsSearch}
                  onChangeText={setSacsSearch}
                  style={[styles.searchInput, { color: textPrimary }]}
                />
                {sacsSearch ? (
                  <TouchableOpacity onPress={() => setSacsSearch('')}>
                    <Ionicons name="close-circle" size={16} color={textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {/* Batch & Type Filter Pills */}
            {sacsSubTab !== 'permissions' && (
              <View style={{ gap: 8, marginTop: 10 }}>
                {/* Batch Filter Pills */}
                {combinedBatches.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setSacsBatchFilter('all')}
                      style={[
                        styles.filterPill,
                        {
                          backgroundColor: sacsBatchFilter === 'all' ? themeRed : inputBg,
                          borderColor: sacsBatchFilter === 'all' ? themeRed : borderColor,
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: sacsBatchFilter === 'all' ? '#fff' : textSecondary }}>
                        All Batches
                      </Text>
                    </TouchableOpacity>
                    {combinedBatches.map((b) => (
                      <TouchableOpacity
                        key={b}
                        onPress={() => setSacsBatchFilter(b)}
                        style={[
                          styles.filterPill,
                          {
                            backgroundColor: sacsBatchFilter === b ? themeRed : inputBg,
                            borderColor: sacsBatchFilter === b ? themeRed : borderColor,
                            paddingVertical: 5,
                            paddingHorizontal: 10,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: sacsBatchFilter === b ? '#fff' : textSecondary }}>
                          {b}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* Request Type Filter Pills */}
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { key: 'all', label: 'All Types' },
                    { key: 'LIVE_SESSION', label: 'Live Class' },
                    { key: 'CLASS', label: 'Recorded Class' },
                  ].map((t) => {
                    const isSelected = sacsTypeFilter === t.key;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        onPress={() => setSacsTypeFilter(t.key)}
                        style={[
                          styles.filterPill,
                          {
                            backgroundColor: isSelected ? (darkMode ? '#334155' : '#e2e8f0') : 'transparent',
                            borderColor: isSelected ? (darkMode ? '#64748b' : '#94a3b8') : borderColor,
                            paddingVertical: 4,
                            paddingHorizontal: 10,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: isSelected ? '800' : '600', color: textPrimary }}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Approval Duration Selector (Only for Requests) */}
            {sacsSubTab === 'requests' && (
              <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: borderColor, gap: 6 }}>
                <Text style={[styles.label, { color: textSecondary, fontSize: 12 }]}>Grant Duration on Approval:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {[
                    { label: '1 Day', days: 1 },
                    { label: '3 Days', days: 3 },
                    { label: '7 Days', days: 7 },
                    { label: '14 Days', days: 14 },
                    { label: '30 Days', days: 30 },
                    { label: 'Perm.', days: 0 },
                  ].map((preset) => {
                    const isSelected = sacsDurationDays === preset.days;
                    return (
                      <TouchableOpacity
                        key={preset.days}
                        onPress={() => setSacsDurationDays(preset.days)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? themeRed : inputBg,
                            borderColor: isSelected ? themeRed : borderColor,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#fff' : textPrimary }}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>`;

const newHeaderBlock = `        return (
        <View style={{ gap: 14 }}>
          {/* Red Section Title matching Image 2 style */}
          <Text style={{ fontSize: 16, fontWeight: '800', color: themeRed, letterSpacing: -0.2 }}>
            Smart Access Control & Permissions
          </Text>

          {/* Full-Width Segmented Sub-Tabs matching Image 2 */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setSacsSubTab('requests')}
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: sacsSubTab === 'requests' ? themeRed : (darkMode ? '#1e1e2e' : '#f5f5f5'),
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: sacsSubTab === 'requests' ? themeRed : borderColor,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: sacsSubTab === 'requests' ? '#ffffff' : textSecondary }}>
                Requests ({sacsRequests.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSacsSubTab('history')}
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: sacsSubTab === 'history' ? themeRed : (darkMode ? '#1e1e2e' : '#f5f5f5'),
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: sacsSubTab === 'history' ? themeRed : borderColor,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: sacsSubTab === 'history' ? '#ffffff' : textSecondary }}>
                History ({sacsHistory.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Secondary Sub-Tabs: Permanent & Rules */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setSacsSubTab('permanent')}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 8,
                borderRadius: 6,
                backgroundColor: sacsSubTab === 'permanent' ? (darkMode ? '#334155' : '#475569') : (darkMode ? '#1e1e2e' : '#f8fafc'),
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: sacsSubTab === 'permanent' ? (darkMode ? '#475569' : '#334155') : borderColor,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: sacsSubTab === 'permanent' ? '#ffffff' : textSecondary }}>
                Permanent Grants ({sacsPermanent.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSacsSubTab('permissions')}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 8,
                borderRadius: 6,
                backgroundColor: sacsSubTab === 'permissions' ? (darkMode ? '#334155' : '#475569') : (darkMode ? '#1e1e2e' : '#f8fafc'),
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: sacsSubTab === 'permissions' ? (darkMode ? '#475569' : '#334155') : borderColor,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: sacsSubTab === 'permissions' ? '#ffffff' : textSecondary }}>
                Access Policies
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filter Batch Banner matching Image 2 yellow/amber filter box */}
          {sacsSubTab !== 'permissions' && (
            <View style={{
              backgroundColor: darkMode ? '#261b0d' : '#fff8e1',
              padding: 10,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: darkMode ? '#5c3d10' : '#ffe082',
              gap: 8,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 180 }}>
                  <Ionicons name="filter" size={16} color="#e65100" />
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#e65100' }}>Filter Batch:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setSacsBatchFilter('all')}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        backgroundColor: sacsBatchFilter === 'all' ? '#e65100' : (darkMode ? '#332312' : '#ffffff'),
                        borderWidth: 1,
                        borderColor: '#ffb74d',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: sacsBatchFilter === 'all' ? '#ffffff' : '#e65100' }}>
                        All Batches
                      </Text>
                    </TouchableOpacity>
                    {combinedBatches.map((b) => (
                      <TouchableOpacity
                        key={b}
                        onPress={() => setSacsBatchFilter(b)}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                          backgroundColor: sacsBatchFilter === b ? '#e65100' : (darkMode ? '#332312' : '#ffffff'),
                          borderWidth: 1,
                          borderColor: '#ffb74d',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: sacsBatchFilter === b ? '#ffffff' : '#e65100' }}>
                          {b}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <Text style={{ fontSize: 11, color: darkMode ? '#ffcc80' : '#757575', fontWeight: '600' }}>
                  Showing {sacsSubTab === 'requests' ? filteredRequests.length : sacsSubTab === 'history' ? filteredHistory.length : filteredPermanent.length} of {sacsSubTab === 'requests' ? sacsRequests.length : sacsSubTab === 'history' ? sacsHistory.length : sacsPermanent.length}
                </Text>
              </View>

              {/* Type Filter Pills & Search in Filter Box */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { key: 'all', label: 'All Types' },
                  { key: 'LIVE_SESSION', label: 'Live Class' },
                  { key: 'CLASS', label: 'Recorded Class' },
                ].map((t) => {
                  const isSelected = sacsTypeFilter === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setSacsTypeFilter(t.key)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 4,
                        backgroundColor: isSelected ? '#e65100' : (darkMode ? '#332312' : '#ffffff'),
                        borderWidth: 1,
                        borderColor: '#ffb74d',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#ffffff' : '#e65100' }}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Search Bar */}
          {sacsSubTab !== 'permissions' && (
            <View style={[styles.searchBar, { backgroundColor: inputBg, borderColor }]}>
              <Ionicons name="search" size={14} color={textSecondary} />
              <TextInput
                placeholder="Search student, content, reason..."
                placeholderTextColor={textSecondary}
                value={sacsSearch}
                onChangeText={setSacsSearch}
                style={[styles.searchInput, { color: textPrimary }]}
              />
              {sacsSearch ? (
                <TouchableOpacity onPress={() => setSacsSearch('')}>
                  <Ionicons name="close-circle" size={16} color={textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* Approval Duration Selector (Only for Requests) */}
          {sacsSubTab === 'requests' && (
            <View style={[styles.card, { backgroundColor: bgCard, borderColor, padding: 12, gap: 6 }]}>
              <Text style={[styles.label, { color: textSecondary, fontSize: 11 }]}>GRANT DURATION ON APPROVAL:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {[
                  { label: '1 Day', days: 1 },
                  { label: '3 Days', days: 3 },
                  { label: '7 Days', days: 7 },
                  { label: '14 Days', days: 14 },
                  { label: '30 Days', days: 30 },
                  { label: 'Perm.', days: 0 },
                ].map((preset) => {
                  const isSelected = sacsDurationDays === preset.days;
                  return (
                    <TouchableOpacity
                      key={preset.days}
                      onPress={() => setSacsDurationDays(preset.days)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? themeRed : inputBg,
                          borderColor: isSelected ? themeRed : borderColor,
                          paddingHorizontal: 12,
                          paddingVertical: 5,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#fff' : textPrimary }}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Label matching Image 2 */}
          {sacsSubTab === 'requests' && (
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: themeRed, marginTop: 4 }}>
              Students requesting temporary / special access:
            </Text>
          )}`;

if (!norm.includes(oldHeaderBlock)) {
  console.error("oldHeaderBlock not found in MobileLMSPages.tsx!");
  process.exit(1);
}

norm = norm.replace(oldHeaderBlock, newHeaderBlock);
fs.writeFileSync(targetFile, isCrlf ? norm.replace(/\n/g, '\r\n') : norm, 'utf8');
console.log("Updated MobileLMSPages.tsx successfully to match Image 2!");
