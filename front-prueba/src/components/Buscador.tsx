function Buscador({ query, onChange }: { query: string, onChange: (value: string) => void }) {
    return (
        <>
            <div className='w-full flex justify-end p-6'>
                <input
                    className='bg-[#1b1e1f] border border-gray-300 rounded-md py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-1/3'
                    type="text"
                    name="buscador"
                    id="buscador"
                    value={query}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Buscar productos..."
                />
            </div>
        </>
    );
}

export default Buscador;