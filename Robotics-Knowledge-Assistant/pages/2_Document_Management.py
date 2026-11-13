"""Page 3: Document Management (upload, update, re-index, delete)."""

import pandas as pd
import streamlit as st

from app import get_services
from config import DEFAULT_CHUNK_OVERLAP, DEFAULT_CHUNK_SIZE, ROBOTICS_DOMAINS


def main() -> None:
    st.set_page_config(page_title="Document Management", layout="wide")
    st.title("Document Management")

    db, _, doc_mgr = get_services()

    with st.form("upload_form"):
        files = st.file_uploader(
            "Upload PDF, TXT, or DOCX files",
            type=["pdf", "txt", "docx"],
            accept_multiple_files=True,
        )
        col1, col2, col3 = st.columns(3)
        domain = col1.selectbox("Domain", ROBOTICS_DOMAINS)
        chunk_size = col2.number_input("Chunk Size", min_value=250, max_value=2000, value=DEFAULT_CHUNK_SIZE)
        chunk_overlap = col3.number_input("Chunk Overlap", min_value=0, max_value=500, value=DEFAULT_CHUNK_OVERLAP)
        submitted = st.form_submit_button("Upload & Index")

    if submitted:
        if not files:
            st.warning("Please upload a supported document.")
        else:
            for uploaded in files:
                res = doc_mgr.ingest_bytes(
                    uploaded.name,
                    uploaded.getvalue(),
                    domain=domain,
                    chunk_size=int(chunk_size),
                    chunk_overlap=int(chunk_overlap),
                )
                if res["status"] == "indexed":
                    st.success(f"{uploaded.name}: {res['message']}")
                else:
                    st.warning(f"{uploaded.name}: {res['message']}")

    docs = db.list_documents()
    st.subheader(f"Uploaded Documents ({len(docs)})")
    if docs:
        df = pd.DataFrame(docs)[
            ["id", "filename", "file_type", "domain", "version", "page_count", "chunk_count", "status"]
        ]
        st.dataframe(df, use_container_width=True, hide_index=True)

        selected_id = st.selectbox("Select Document ID to Manage", [d["id"] for d in docs])
        col_u, col_d = st.columns(2)
        with col_u:
            replacement = st.file_uploader("Upload New Version", type=["pdf", "txt", "docx"], key="update_file")
            if st.button("Update Document"):
                if replacement is None:
                    st.warning("Select a replacement file first.")
                else:
                    out = doc_mgr.update_document(selected_id, replacement.getvalue(), replacement.name)
                    st.info(out["message"])
                    st.rerun()
        with col_d:
            if st.button("Delete Selected Document", type="primary"):
                if doc_mgr.delete_document(selected_id):
                    st.success("Document deleted successfully.")
                    st.rerun()
    else:
        st.info("No documents in repository.")


if __name__ == "__main__":
    main()
