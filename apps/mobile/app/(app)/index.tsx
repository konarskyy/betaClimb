import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useRouter } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, imageSrc } from "@/api";
import { Button } from "@/components/ui";
import { GradeBadge } from "@/components/GradeBadge";
import { colors, radius, spacing } from "@/theme";
import type { RouteSummary } from "@/types";

export default function RoutesList() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["routes"],
    queryFn: api.listRoutes,
  });

  const renderItem = useCallback(
    ({ item }: { item: RouteSummary }) => (
      <Pressable
        onPress={() => router.push(`/(app)/route/${item.id}`)}
        style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
      >
        {imageSrc(item.imageUrl) ? (
          <Image source={{ uri: imageSrc(item.imageUrl)! }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Text style={styles.thumbEmptyText}>brak{"\n"}zdjęcia</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            {item._count?.holds ?? 0} chwytów · {item.routeHeightM} m
          </Text>
          {item.grade && (
            <View style={{ marginTop: spacing.xs, alignSelf: "flex-start" }}>
              <GradeBadge grade={item.grade} size="sm" />
            </View>
          )}
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    ),
    [router],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/(app)/profile" style={styles.headerLink}>
              Profil
            </Link>
          ),
        }}
      />

      <View style={styles.topBar}>
        <Button title="+ Nowa trasa" onPress={() => router.push("/(app)/new-route")} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Nie udało się pobrać tras.</Text>
          <Button title="Spróbuj ponownie" variant="secondary" onPress={() => refetch()} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>
                Nie masz jeszcze żadnych tras.{"\n"}Dodaj pierwszą, aby zobaczyć betę.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: { padding: spacing.md, paddingBottom: 0 },
  headerLink: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.md,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  thumbEmptyText: { color: colors.textMuted, fontSize: 10, textAlign: "center" },
  name: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.textMuted, marginTop: 2 },
  chevron: { color: colors.textMuted, fontSize: 28, paddingRight: spacing.sm },
  center: { alignItems: "center", padding: spacing.xl, gap: spacing.md },
  muted: { color: colors.textMuted, textAlign: "center" },
});
