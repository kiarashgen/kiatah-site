import os
from langchain_community.document_loaders import PyMuPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains.retrieval import create_retrieval_chain

# --- OPTIONAL: Persian Text Fixer ---
# Most Iranian PDFs store text visually (left-to-right).
# This fixes it so the AI reads "سلام" instead of "م‌ا‌ل‌س"
import arabic_reshaper
from bidi.algorithm import get_display


def clean_persian_text(text):
    if not text:
        return ""
    try:
        # 1. Reshape letters (connect them)
        reshaped_text = arabic_reshaper.reshape(text)
        # 2. Fix direction (Right-to-Left)
        bidi_text = get_display(reshaped_text)
        return bidi_text
    except:
        return text


# --- Step 1: Load the PDF ---
pdf_path = "Mabhas19.pdf"  # Make sure this file exists!
print(f"--- Loading {pdf_path}... ---")

try:
    loader = PyMuPDFLoader(pdf_path)
    docs = loader.load()

    # Apply the Persian fix to every page immediately
    for doc in docs:
        doc.page_content = clean_persian_text(doc.page_content)

    print(f"--- Document loaded: {len(docs)} pages ---")
except Exception as e:
    print(f"Error loading PDF: {e}")
    exit()

# --- Step 2: Split into Chunks ---
# We use separators that work for Persian (Newlines, Persian period, spaces)
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=600,
    chunk_overlap=100,
    separators=["\n\n", "\n", "۔", ".", " ", ""]
)
splits = text_splitter.split_documents(docs)

print(f"--- Split into {len(splits)} chunks ---")

# --- Step 3: Embeddings (Crucial Change) ---
# We use a Multilingual model. 'bge-small-en' DOES NOT work for Persian.
# This runs locally on your CPU/GPU.
model_name = "intfloat/multilingual-e5-large"
print(
    f"--- Loading Embedding Model: {model_name} (This might take a minute)... ---")

embeddings = HuggingFaceEmbeddings(
    model_name=model_name,
    model_kwargs={'device': 'cpu'},  # Change to 'cuda' if you have a GPU
    encode_kwargs={'normalize_embeddings': True}
)

# --- Step 4: Vector Store ---
print("--- Creating Vector Store... ---")
vectorstore = FAISS.from_documents(documents=splits, embedding=embeddings)

# --- Step 5: The RAG Chain ---

# a) LLM (Make sure Ollama is running: `ollama run llama3.1`)
llm = ChatOllama(model="llama3.1:8b", temperature=0)

# b) Retriever
retriever = vectorstore.as_retriever(
    search_kwargs={"k": 4})  # Retrieve top 4 chunks

# c) Prompt (Persian Instructions)
# We force the model to answer in Persian and act like an engineer.
prompt = ChatPromptTemplate.from_template("""
You are an expert architect on the Iranian National Building Regulations (Mabhas 19).
Answer the user's question based ONLY on the following context. 
If the answer is found in a table, try to interpret the rows and columns.
If you don't know the answer, strictly say "Information not found in context".

<context>
{context}
</context>

Question: {input}
Answer in Persian:
""")

document_chain = create_stuff_documents_chain(llm, prompt)
rag_chain = create_retrieval_chain(retriever, document_chain)

print("--- System Ready. Ask a question about Section 19. ---")

# --- Step 6: Loop for Testing ---
while True:
    question = input("\nAsk (or 'q' to quit): ")
    if question.lower() == 'q':
        break

    print("Thinking...")
    response = rag_chain.invoke({"input": question})

    print("\n--- Answer ---")
    print(response["answer"])

    print("\n--- Source Audit (Check if this text is garbage) ---")
    # This is where you find flaws. Look at what the AI actually read.
    for i, doc in enumerate(response["context"]):
        # Print first 100 chars
        print(
            f"[Page {doc.metadata.get('page', '?') + 1}]: {doc.page_content[:100]}...")
