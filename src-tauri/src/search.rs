use crate::models::{EmailRelationSummary, FieldKind, VaultEntry};
use crate::parser::{looks_like_email, normalize_email};
use std::collections::BTreeMap;

pub fn entry_emails(entry: &VaultEntry) -> Vec<String> {
    let mut emails = Vec::new();
    for field in &entry.fields {
        if field.kind == FieldKind::Email || looks_like_email(&field.value) {
            let norm = normalize_email(&field.value);
            if !norm.is_empty() && !emails.contains(&norm) {
                emails.push(norm);
            }
        }
    }
    emails
}

pub fn filter_entries(
    entries: &[VaultEntry],
    query: &str,
    email_filter: Option<&str>,
    tag_filter: Option<&str>,
    favorites_only: bool,
) -> Vec<VaultEntry> {
    let tokens: Vec<String> = query
        .trim()
        .to_lowercase()
        .split_whitespace()
        .map(String::from)
        .collect();
    let target_email = email_filter.map(normalize_email).filter(|s| !s.is_empty());
    let target_tag = tag_filter
        .map(|t| t.trim().trim_start_matches('#').to_lowercase())
        .filter(|s| !s.is_empty());

    entries
        .iter()
        .filter(|entry| {
            if favorites_only && !entry.favorite {
                return false;
            }
            if let Some(ref em) = target_email {
                if !entry_emails(entry).contains(em) {
                    return false;
                }
            }
            if let Some(ref tg) = target_tag {
                if !entry.tags.iter().any(|t| t.eq_ignore_ascii_case(tg)) {
                    return false;
                }
            }
            if tokens.is_empty() {
                return true;
            }

            let haystack = format!(
                "{} {} {} {}",
                entry.title.to_lowercase(),
                entry.notes.to_lowercase(),
                entry.tags.join(" ").to_lowercase(),
                entry
                    .fields
                    .iter()
                    .map(|f| format!(
                        "{} {} {}",
                        f.key.to_lowercase(),
                        f.value.to_lowercase(),
                        normalize_email(&f.value)
                    ))
                    .collect::<Vec<_>>()
                    .join(" ")
            );

            tokens.iter().all(|tok| haystack.contains(tok))
        })
        .cloned()
        .collect()
}

pub fn build_email_relations(entries: &[VaultEntry]) -> Vec<EmailRelationSummary> {
    let mut map: BTreeMap<String, (Vec<String>, Vec<String>)> = BTreeMap::new();

    for entry in entries {
        for email in entry_emails(entry) {
            let group = map.entry(email).or_insert_with(|| (Vec::new(), Vec::new()));
            group.0.push(entry.id.clone());
            group.1.push(entry.title.clone());
        }
    }

    let mut summaries: Vec<EmailRelationSummary> = map
        .into_iter()
        .map(|(email, (entry_ids, titles))| EmailRelationSummary {
            email,
            count: entry_ids.len(),
            entry_ids,
            titles,
        })
        .collect();

    summaries.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.email.cmp(&b.email)));
    summaries
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse_entry_text;

    fn make_entry(id: &str, raw: &str) -> VaultEntry {
        let draft = parse_entry_text(raw).unwrap();
        VaultEntry {
            id: id.to_string(),
            title: draft.title,
            raw_text: draft.raw_text,
            fields: draft.fields,
            tags: draft.tags,
            notes: draft.notes,
            favorite: false,
            created_at: "2026-11-08T00:00:00Z".to_string(),
            updated_at: "2026-11-08T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn test_reverse_email_relations_groups_accounts_accurately() {
        let entries = vec![
            make_entry("1", "amazon video\nemail: test:@gmail.com\npass: test123"),
            make_entry("2", "netflix #streaming\nemail: test@gmail.com\npass: nf999"),
            make_entry("3", "xbox #game\nemail: kedua@yahoo.com\npass: xb123"),
        ];

        let relations = build_email_relations(&entries);
        assert_eq!(relations.len(), 2);
        assert_eq!(relations[0].email, "test@gmail.com");
        assert_eq!(relations[0].count, 2);
        assert_eq!(relations[0].titles, vec!["amazon video", "netflix"]);

        let filtered = filter_entries(&entries, "", Some("test@gmail.com"), None, false);
        assert_eq!(filtered.len(), 2);
    }
}
