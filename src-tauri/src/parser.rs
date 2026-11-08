use crate::models::{EntryField, FieldKind, ParsedEntryDraft};

pub fn classify_field(key: &str, value: &str) -> FieldKind {
    let k = key.trim().to_lowercase();
    let v = value.trim().to_lowercase();

    let secret_keywords = [
        "pass", "password", "pwd", "sandi", "pin", "key", "apikey", "api_key", "api-key",
        "token", "secret", "recovery", "otp", "2fa", "seed", "phrase", "cvv", "private",
    ];
    if secret_keywords.iter().any(|kw| k.contains(kw)) {
        return FieldKind::Secret;
    }

    let email_keywords = ["email", "e-mail", "mail", "gmail"];
    if email_keywords.iter().any(|kw| k == *kw || k.ends_with(kw)) || looks_like_email(&v) {
        return FieldKind::Email;
    }

    let url_keywords = ["url", "link", "web", "website", "site", "domain"];
    if url_keywords.iter().any(|kw| k == *kw)
        || v.starts_with("http://")
        || v.starts_with("https://")
    {
        return FieldKind::Url;
    }

    FieldKind::Text
}

pub fn looks_like_email(val: &str) -> bool {
    let cleaned = normalize_email(val);
    if let Some((local, domain)) = cleaned.split_once('@') {
        !local.is_empty() && domain.contains('.') && !domain.starts_with('.') && !domain.ends_with('.')
    } else {
        false
    }
}

pub fn normalize_email(raw_email: &str) -> String {
    let trimmed = raw_email.trim().to_lowercase();
    trimmed.replace(":@", "@")
}

fn extract_inline_tags(line: &str) -> (String, Vec<String>) {
    let mut tags = Vec::new();
    let mut kept_words = Vec::new();

    for token in line.split_whitespace() {
        if let Some(tag) = token.strip_prefix('#') {
            let cleaned: String = tag
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
                .collect::<String>()
                .to_lowercase();
            if !cleaned.is_empty() {
                tags.push(cleaned);
                continue;
            }
        }
        kept_words.push(token);
    }

    (kept_words.join(" "), tags)
}

pub fn parse_entry_text(raw: &str) -> Option<ParsedEntryDraft> {
    let normalized = raw.replace("\r\n", "\n");
    let trimmed = normalized.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut lines = trimmed.lines().map(str::trim).filter(|l| !l.is_empty());
    let first_line = lines.next()?;

    let mut tags: Vec<String> = Vec::new();
    let (clean_title, first_line_tags) = extract_inline_tags(first_line);
    for t in first_line_tags {
        if !tags.contains(&t) {
            tags.push(t);
        }
    }

    let title = if clean_title.is_empty() {
        first_line.to_string()
    } else {
        clean_title
    };

    let mut fields: Vec<EntryField> = Vec::new();
    let mut notes_lines: Vec<String> = Vec::new();

    for line in lines {
        let (line_without_tags, line_tags) = extract_inline_tags(line);
        for t in line_tags {
            if !tags.contains(&t) {
                tags.push(t);
            }
        }

        if line_without_tags.is_empty() {
            continue;
        }

        if let Some((raw_key, raw_val)) = line_without_tags.split_once(':') {
            let key = raw_key.trim();
            let val = raw_val.trim();
            if !key.is_empty()
                && key.len() <= 40
                && !key.eq_ignore_ascii_case("http")
                && !key.eq_ignore_ascii_case("https")
                && !val.is_empty()
            {
                let kind = classify_field(key, val);
                fields.push(EntryField {
                    key: key.to_string(),
                    value: val.to_string(),
                    kind,
                });
                continue;
            }
        }

        notes_lines.push(line_without_tags);
    }

    Some(ParsedEntryDraft {
        title,
        raw_text: trimmed.to_string(),
        fields,
        tags,
        notes: notes_lines.join("\n"),
    })
}

pub fn parse_bulk_text(raw_bulk: &str) -> Vec<ParsedEntryDraft> {
    let normalized = raw_bulk.replace("\r\n", "\n");
    let mut blocks: Vec<String> = Vec::new();
    let mut current_block: Vec<&str> = Vec::new();

    for line in normalized.lines() {
        if line.trim().is_empty() {
            if !current_block.is_empty() {
                blocks.push(current_block.join("\n"));
                current_block.clear();
            }
        } else {
            current_block.push(line);
        }
    }
    if !current_block.is_empty() {
        blocks.push(current_block.join("\n"));
    }

    blocks
        .iter()
        .filter_map(|block| parse_entry_text(block))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_amazon_video_with_double_colon_email() {
        let raw = "amazon video\nemail: test:@gmail.com\npass: test123";
        let draft = parse_entry_text(raw).expect("should parse");
        assert_eq!(draft.title, "amazon video");
        assert_eq!(draft.fields.len(), 2);
        assert_eq!(draft.fields[0].key, "email");
        assert_eq!(draft.fields[0].value, "test:@gmail.com");
        assert_eq!(draft.fields[0].kind, FieldKind::Email);
        assert_eq!(normalize_email(&draft.fields[0].value), "test@gmail.com");

        assert_eq!(draft.fields[1].key, "pass");
        assert_eq!(draft.fields[1].value, "test123");
        assert_eq!(draft.fields[1].kind, FieldKind::Secret);
    }

    #[test]
    fn test_parse_minimal_xbox_entry_and_tags() {
        let raw = "xbox #game\npass: test123\ncatatan tambahan tanpa titik dua";
        let draft = parse_entry_text(raw).expect("should parse");
        assert_eq!(draft.title, "xbox");
        assert_eq!(draft.tags, vec!["game".to_string()]);
        assert_eq!(draft.fields.len(), 1);
        assert_eq!(draft.fields[0].kind, FieldKind::Secret);
        assert_eq!(draft.notes, "catatan tambahan tanpa titik dua");
    }

    #[test]
    fn test_parse_bulk_multiple_chat_entries() {
        let bulk = "amazon video\nemail: test@gmail.com\npass: test123\n\nxbox\npass: test123\n\nopenai api #work\nkey: sk-12345";
        let drafts = parse_bulk_text(bulk);
        assert_eq!(drafts.len(), 3);
        assert_eq!(drafts[0].title, "amazon video");
        assert_eq!(drafts[1].title, "xbox");
        assert_eq!(drafts[2].title, "openai api");
        assert_eq!(drafts[2].fields[0].kind, FieldKind::Secret);
        assert_eq!(drafts[2].tags, vec!["work".to_string()]);
    }
}
